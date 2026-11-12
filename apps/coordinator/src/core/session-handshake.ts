import {
    type AgencyStatePayload,
    attempt,
    type AuthenticatedBot,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    type Result,
    SessionAuthenticator,
    type SessionResume,
    type TransportFailure,
} from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { AgencyStateRecord, BotFailure, BotProfile, BotResumePlan } from '../bots/index.js';
import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { SessionManager } from './session-manager.js';

export interface SessionBotRegistry {
    authenticate(botId: string, username: string, now: string): Result<BotProfile, BotFailure>;
    markOnline(botId: string, now: string): Result<BotProfile, BotFailure>;
    resume(botId: string, now: string): Result<BotResumePlan, BotFailure>;
}

export interface SessionHandshakeOptions {
    epoch: number;
    botNames: string[];
    sessions: SessionManager;
    events: EventLogWriter;
    transport: TransportServer;
    logger: LoggerPort;
    bots: SessionBotRegistry;
}

export class SessionHandshake {
    constructor(private readonly options: SessionHandshakeOptions) {}

    handle(connection: ClientConnection, request: Envelope): void {
        const [bot, authenticationError] = SessionAuthenticator.authenticate(
            request.payload,
            this.options.botNames,
        );
        if (authenticationError || bot === null) {
            const message = authenticationError
                ? this.failureMessage(authenticationError)
                : 'authentication failed';
            this.reject(connection, request, message);
            return;
        }

        this.accept(connection, request, bot);
    }

    private accept(connection: ClientConnection, request: Envelope, bot: AuthenticatedBot): void {
        const now = new Date().toISOString();
        const [profile, profileError] = this.options.bots.authenticate(bot.botId, bot.name, now);
        if (profileError || profile === null) {
            this.reject(
                connection,
                request,
                profileError ? this.botFailureMessage(profileError) : 'profile unavailable',
            );
            return;
        }
        if (connection.botId) this.options.sessions.remove(connection.botId);
        connection.botId = bot.botId;
        connection.name = bot.name;
        const [, presenceError] = this.options.bots.markOnline(bot.botId, now);
        if (presenceError) {
            this.options.logger.warn(
                { botId: bot.botId, error: this.botFailureMessage(presenceError) },
                'bot presence update failed',
            );
        }
        const [resumePlan, resumeError] = this.options.bots.resume(bot.botId, now);
        if (resumeError) {
            this.options.logger.warn(
                { botId: bot.botId, error: this.botFailureMessage(resumeError) },
                'bot resume failed',
            );
        } else if (resumePlan !== null) {
            this.options.logger.info(
                {
                    botId: bot.botId,
                    taskId: resumePlan.profile.currentTaskId,
                    claims: resumePlan.claims.length,
                    grants: resumePlan.grants.length,
                },
                'bot resume prepared',
            );
        }
        this.options.sessions.add({
            botId: bot.botId,
            name: bot.name,
            connectionId: connection.id,
            connectedAt: now,
            lastSeen: now,
            position: null,
        });
        const [, logError] = this.options.events.append({
            botId: bot.botId,
            type: 'session.joined',
            payload: { name: bot.name },
        });
        if (logError) {
            this.options.logger.warn({ error: this.describe(logError) }, 'session join log failed');
        }
        this.sendEnvelope(
            connection,
            ProtocolEnvelope.create(
                'response',
                'session.hello.response',
                {
                    accepted: true,
                    epoch: this.options.epoch,
                    resume:
                        resumePlan === null
                            ? undefined
                            : SessionHandshake.resumePayload(resumePlan),
                },
                { replyTo: request.id },
            ),
        );
        this.options.logger.info(
            { botId: bot.botId, name: bot.name, epoch: this.options.epoch },
            'bot session accepted',
        );
    }

    private reject(connection: ClientConnection, request: Envelope, message: string): void {
        this.sendEnvelope(
            connection,
            ProtocolEnvelope.create(
                'response',
                'session.hello.response',
                { accepted: false, epoch: this.options.epoch, reason: message },
                { replyTo: request.id, error: { code: 'auth_failed', message } },
            ),
        );
        this.options.logger.warn(
            { connectionId: connection.id, error: message },
            'bot session rejected',
        );
        const [, closeError] = attempt(() => connection.socket.close());
        if (closeError) {
            this.options.logger.debug(
                { connectionId: connection.id, error: this.describe(closeError) },
                'socket close failed',
            );
        }
    }

    private static resumePayload(plan: BotResumePlan): SessionResume {
        const agency = plan.agency === null ? null : SessionHandshake.agencyPayload(plan.agency);
        const task = plan.task;
        if (
            task === null ||
            task.leaseToken === null ||
            (task.status !== 'claimed' && task.status !== 'running')
        ) {
            return {
                task: null,
                fencingToken: null,
                leaseUntil: null,
                sipRevision: plan.delta.sipRevision,
                agency,
            };
        }
        return {
            task: {
                id: task.id,
                title: task.title,
                priority: task.priority,
                payload: task.payload,
                target: task.target,
                requiredRole: task.requiredRole,
            },
            fencingToken: task.leaseToken,
            leaseUntil: task.leaseUntil,
            checkpoint: plan.checkpoint ?? undefined,
            sipRevision: plan.delta.sipRevision,
            agency,
        };
    }

    private static agencyPayload(record: AgencyStateRecord): AgencyStatePayload {
        return {
            traits: record.traits.traits,
            needs: record.needs.levels,
            intention: record.intention,
            routine: record.routine,
            homeStructureId: record.homeStructureId,
            personalStorageId: record.personalStorageId,
            mood: record.mood,
            lastDeliberationAt: record.lastDeliberationAt,
        };
    }

    private sendEnvelope(connection: ClientConnection, envelope: Envelope): void {
        const [, sendError] = this.options.transport.send(connection, envelope);
        if (sendError) {
            this.options.logger.warn(
                { error: sendError, type: envelope.type },
                'transport send failed',
            );
        }
    }

    private failureMessage(failure: TransportFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }

    private botFailureMessage(failure: BotFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

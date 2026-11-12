import {
    AGENCY_EPISODE_EVENT,
    AGENCY_STATE_EVENT,
    BLOCK_UPDATE_EVENT,
    type BlockUpdateMessage,
    blockUpdateSchema,
    BOT_BLUEPRINT_GET,
    BOT_CONSTRUCTION_PLAN_GET,
    BOT_JOB_DECIDE,
    BOT_JOB_OFFERS,
    BOT_PROJECT_ABANDON,
    BOT_PROJECT_PROPOSE,
    type BotAgencyEpisodeMessage,
    botAgencyEpisodeSchema,
    type BotAgencyStateMessage,
    botAgencyStateSchema,
    type BotBlueprintGet,
    botBlueprintGetSchema,
    type BotConstructionPlanGet,
    botConstructionPlanGetSchema,
    botHeartbeatSchema,
    type BotJobDecide,
    botJobDecideSchema,
    type BotJobOffers,
    botJobOffersSchema,
    type BotProjectAbandon,
    botProjectAbandonSchema,
    type BotProjectPropose,
    botProjectProposeSchema,
    type BotTaskClaim,
    botTaskClaimSchema,
    type BotTaskComplete,
    botTaskCompleteSchema,
    type BotTaskFail,
    botTaskFailSchema,
    type BotTaskRenew,
    botTaskRenewSchema,
    CHUNK_SNAPSHOT_EVENT,
    type ChunkSnapshotMessage,
    chunkSnapshotSchema,
    DECISION_REQUEST,
    type DecisionRequest,
    decisionRequestSchema,
    type Envelope,
    LANDMARK_CANDIDATE_EVENT,
    type LandmarkCandidateMessage,
    landmarkCandidateSchema,
    type LoggerPort,
    SKILL_PROGRESS_EVENT,
    skillProgressSchema,
    TASK_CLAIM,
    TASK_COMPLETE,
    TASK_FAIL,
    TASK_RENEW,
} from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { ClientConnection } from '../transport/index.js';
import type { CommandRouter } from './command-router.js';
import type { SessionHandshake } from './session-handshake.js';
import type { SessionManager } from './session-manager.js';

export interface MessageRouterOptions {
    sessions: SessionManager;
    router: CommandRouter;
    handshake: SessionHandshake;
    events: EventLogWriter;
    logger: LoggerPort;
    onAgencyState?: (payload: BotAgencyStateMessage) => void;
    onAgencyEpisode?: (payload: BotAgencyEpisodeMessage) => void;
    onChunkSnapshot?: (payload: ChunkSnapshotMessage) => void;
    onLandmarkCandidate?: (payload: LandmarkCandidateMessage) => void;
    onBlockUpdate?: (payload: BlockUpdateMessage) => void;
    onDecisionRequest?: (
        connection: ClientConnection,
        payload: DecisionRequest,
        envelope: Envelope,
    ) => void;
    onProjectPropose?: (
        connection: ClientConnection,
        payload: BotProjectPropose,
        envelope: Envelope,
    ) => void;
    onProjectAbandon?: (
        connection: ClientConnection,
        payload: BotProjectAbandon,
        envelope: Envelope,
    ) => void;
    onBlueprintGet?: (
        connection: ClientConnection,
        payload: BotBlueprintGet,
        envelope: Envelope,
    ) => void;
    onConstructionPlanGet?: (
        connection: ClientConnection,
        payload: BotConstructionPlanGet,
        envelope: Envelope,
    ) => void;
    onJobOffers?: (connection: ClientConnection, payload: BotJobOffers, envelope: Envelope) => void;
    onJobDecide?: (connection: ClientConnection, payload: BotJobDecide, envelope: Envelope) => void;
    onTaskClaim?: (connection: ClientConnection, payload: BotTaskClaim, envelope: Envelope) => void;
    onTaskRenew?: (connection: ClientConnection, payload: BotTaskRenew, envelope: Envelope) => void;
    onTaskComplete?: (
        connection: ClientConnection,
        payload: BotTaskComplete,
        envelope: Envelope,
    ) => void;
    onTaskFail?: (connection: ClientConnection, payload: BotTaskFail, envelope: Envelope) => void;
    onSessionClosed?: (botId: string) => void;
}

export class MessageRouter {
    constructor(private readonly options: MessageRouterOptions) {}

    handleMessage(connection: ClientConnection, envelope: Envelope): void {
        if (envelope.kind === 'request' && envelope.type === 'session.hello') {
            this.options.handshake.handle(connection, envelope);
            return;
        }
        if (!connection.botId) {
            this.options.logger.warn(
                { connectionId: connection.id },
                'message before session hello',
            );
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.heartbeat') {
            const parsed = botHeartbeatSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid bot heartbeat');
                this.options.sessions.touch(connection.botId);
                return;
            }
            this.options.sessions.touch(
                connection.botId,
                new Date().toISOString(),
                parsed.data.digest.position,
            );
            return;
        }
        if (envelope.kind === 'event' && envelope.type === AGENCY_STATE_EVENT) {
            const parsed = botAgencyStateSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid agency state');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onAgencyState?.(parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === AGENCY_EPISODE_EVENT) {
            const parsed = botAgencyEpisodeSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid agency episode');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onAgencyEpisode?.(parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.event') {
            this.options.logger.debug(
                { botId: connection.botId, event: envelope.payload },
                'bot event',
            );
            this.appendEvent(connection.botId, 'bot.event', envelope.payload);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === SKILL_PROGRESS_EVENT) {
            const parsed = skillProgressSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid skill progress');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.appendEvent(connection.botId, SKILL_PROGRESS_EVENT, parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === CHUNK_SNAPSHOT_EVENT) {
            const parsed = chunkSnapshotSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid chunk snapshot');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onChunkSnapshot?.(parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === LANDMARK_CANDIDATE_EVENT) {
            const parsed = landmarkCandidateSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid landmark candidate');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onLandmarkCandidate?.(parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === BLOCK_UPDATE_EVENT) {
            const parsed = blockUpdateSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid block update');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onBlockUpdate?.(parsed.data);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === BOT_BLUEPRINT_GET) {
            const parsed = botBlueprintGetSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid blueprint request');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onBlueprintGet?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === BOT_CONSTRUCTION_PLAN_GET) {
            const parsed = botConstructionPlanGetSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn(
                    { botId: connection.botId },
                    'invalid construction plan request',
                );
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onConstructionPlanGet?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === BOT_PROJECT_PROPOSE) {
            const parsed = botProjectProposeSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid project propose');
                return;
            }
            this.options.sessions.touch(connection.botId ?? '');
            this.options.onProjectPropose?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === BOT_PROJECT_ABANDON) {
            const parsed = botProjectAbandonSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid project abandon');
                return;
            }
            this.options.sessions.touch(connection.botId ?? '');
            this.options.onProjectAbandon?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === BOT_JOB_OFFERS) {
            const parsed = botJobOffersSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid job offers request');
                return;
            }
            this.options.sessions.touch(connection.botId ?? '');
            this.options.onJobOffers?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === BOT_JOB_DECIDE) {
            const parsed = botJobDecideSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid job decision');
                return;
            }
            this.options.sessions.touch(connection.botId ?? '');
            this.options.onJobDecide?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === TASK_CLAIM) {
            const parsed = botTaskClaimSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid task claim');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onTaskClaim?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === TASK_RENEW) {
            const parsed = botTaskRenewSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid task renew');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onTaskRenew?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === TASK_COMPLETE) {
            const parsed = botTaskCompleteSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid task complete');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onTaskComplete?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === TASK_FAIL) {
            const parsed = botTaskFailSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid task fail');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onTaskFail?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === DECISION_REQUEST) {
            const parsed = decisionRequestSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid decision request');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onDecisionRequest?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request') {
            const [, routeError] = this.options.router.handle(connection, envelope);
            if (routeError) {
                this.options.logger.warn(
                    { error: routeError, type: envelope.type },
                    'command routing failed',
                );
            }
        }
    }

    handleClose(connection: ClientConnection): void {
        if (!connection.botId) return;
        this.options.onSessionClosed?.(connection.botId);
        const [, logError] = this.options.events.append({
            botId: connection.botId,
            type: 'session.left',
            payload: {},
        });
        if (logError) {
            this.options.logger.warn(
                { error: this.describe(logError) },
                'session leave log failed',
            );
        }
        this.options.sessions.remove(connection.botId);
    }

    private appendEvent(botId: string, type: string, payload: unknown): void {
        const [, logError] = this.options.events.append({ botId, type, payload });
        if (logError) {
            this.options.logger.warn({ error: this.describe(logError), type }, 'event log failed');
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

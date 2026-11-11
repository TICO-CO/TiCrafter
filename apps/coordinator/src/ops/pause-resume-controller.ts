import {
    BOT_AUTONOMY_PAUSE,
    BOT_AUTONOMY_RESUME,
    BOT_SAFETY_RESUME,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { BotFailure, BotPresenceTracker } from '../bots/index.js';
import type { TransportServer } from '../transport/index.js';
import type { OpsMetricsRegistry } from './metrics-registry.js';
import type { OpsStructuredLogger } from './structured-logger.js';
import type { OpsAuditPort, OpsControlRequest, OpsControlResult, OpsFailure } from './types.js';

export interface OpsPauseResumeOptions {
    transport: Pick<TransportServer, 'list' | 'send'>;
    presence: Pick<BotPresenceTracker, 'markOnline' | 'suspend'>;
    audit?: OpsAuditPort;
    logger: OpsStructuredLogger;
    metrics?: OpsMetricsRegistry;
    now?: () => string;
}

export class OpsPauseResumeController {
    constructor(private readonly options: OpsPauseResumeOptions) {}

    pause(request: OpsControlRequest = {}): OpsControlResult {
        return this.run('pause', request, 'ops.pause', BOT_AUTONOMY_PAUSE);
    }

    resume(request: OpsControlRequest = {}): OpsControlResult {
        const startedAt = Date.now();
        const targets = this.targets(request.botId);
        if (targets.failure !== null) {
            this.recordFailure('resume', startedAt);
            return { bots: [], failures: [targets.failure] };
        }
        const bots: string[] = [];
        const failures: OpsFailure[] = [];
        for (const botId of targets.botIds) {
            const connection = this.connection(botId);
            if (connection === null) {
                failures.push({ type: 'BOT_NOT_CONNECTED', botId });
                continue;
            }
            const [, resumeError] = this.send(connection, BOT_AUTONOMY_RESUME, {
                reason: request.reason,
            });
            const [, safetyError] = this.send(connection, BOT_SAFETY_RESUME, {
                reason: request.reason,
            });
            if (resumeError || safetyError) {
                failures.push(this.transportFailure(resumeError ?? safetyError));
                continue;
            }
            const [, presenceError] = this.options.presence.markOnline(
                botId,
                this.options.now?.() ?? new Date().toISOString(),
            );
            if (presenceError) failures.push(this.botFailure(presenceError));
            bots.push(botId);
        }
        this.finish('resume', request, 'ops.resume', bots, failures, startedAt);
        return { bots, failures };
    }

    private run(
        command: string,
        request: OpsControlRequest,
        eventType: string,
        envelopeType: string,
    ): OpsControlResult {
        const startedAt = Date.now();
        const targets = this.targets(request.botId);
        if (targets.failure !== null) {
            this.recordFailure(command, startedAt);
            return { bots: [], failures: [targets.failure] };
        }
        const bots: string[] = [];
        const failures: OpsFailure[] = [];
        for (const botId of targets.botIds) {
            const connection = this.connection(botId);
            if (connection === null) {
                failures.push({ type: 'BOT_NOT_CONNECTED', botId });
                continue;
            }
            const [, sendError] = this.send(connection, envelopeType, {
                reason: request.reason ?? `operator ${command}`,
            });
            if (sendError) {
                failures.push(this.transportFailure(sendError));
                continue;
            }
            const [, presenceError] = this.options.presence.suspend(
                botId,
                this.options.now?.() ?? new Date().toISOString(),
            );
            if (presenceError) failures.push(this.botFailure(presenceError));
            bots.push(botId);
        }
        this.finish(command, request, eventType, bots, failures, startedAt);
        return { bots, failures };
    }

    private finish(
        command: string,
        request: OpsControlRequest,
        eventType: string,
        bots: readonly string[],
        failures: readonly OpsFailure[],
        startedAt: number,
    ): void {
        this.options.metrics?.observe(
            'ops_pause_resume_controller_latency_ms',
            Date.now() - startedAt,
            {
                command,
            },
        );
        if (failures.length > 0) this.recordFailure(command, startedAt);
        const [, auditError] = this.options.audit?.append({
            actor: 'operator',
            type: eventType,
            payload: {
                target: request.botId ?? 'fleet',
                bots,
                failures: failures.map((failure) => failure.type),
                reason: request.reason,
            },
        }) ?? [undefined, null];
        if (auditError) {
            this.options.logger.warn({ error: auditError }, 'ops control audit failed');
        }
    }

    private recordFailure(command: string, _startedAt: number): void {
        this.options.metrics?.increment('ops_pause_resume_controller_errors_total', 1, {
            command,
        });
    }

    private targets(botId?: string): { botIds: readonly string[]; failure: OpsFailure | null } {
        if (botId !== undefined) {
            return this.connection(botId) === null
                ? { botIds: [], failure: { type: 'BOT_NOT_CONNECTED', botId } }
                : { botIds: [botId], failure: null };
        }
        const botIds = this.options.transport
            .list()
            .flatMap((connection) => (connection.botId === undefined ? [] : [connection.botId]));
        return { botIds, failure: null };
    }

    private connection(botId: string) {
        return (
            this.options.transport.list().find((connection) => connection.botId === botId) ?? null
        );
    }

    private send(
        connection: ReturnType<OpsPauseResumeController['connection']>,
        type: string,
        payload: unknown,
    ): Result<void, TransportFailure> {
        if (connection === null) return [null, { type: 'NOT_CONNECTED' }];
        return this.options.transport.send(
            connection,
            ProtocolEnvelope.create('request', type, payload),
        );
    }

    private transportFailure(failure: TransportFailure | null): OpsFailure {
        return {
            type: 'COMMAND_FAILED',
            message:
                failure === null || !('message' in failure) ? 'command failed' : failure.message,
        };
    }

    private botFailure(failure: BotFailure): OpsFailure {
        const message = 'failure' in failure ? failure.failure.message : failure.type;
        return { type: 'COMMAND_FAILED', message };
    }
}

import { BOT_SAFETY_STOP, ProtocolEnvelope, type TransportFailure } from '@ticrafter/core';

import type { BotPresenceTracker } from '../bots/index.js';
import type { TransportServer } from '../transport/index.js';
import type { OpsMetricsRegistry } from './metrics-registry.js';
import type { OpsStructuredLogger } from './structured-logger.js';
import type { OpsAuditPort, OpsControlResult, OpsFailure } from './types.js';

export interface OpsFleetEmergencyStopOptions {
    transport: Pick<TransportServer, 'list' | 'send'>;
    presence: Pick<BotPresenceTracker, 'list' | 'suspend'>;
    audit?: OpsAuditPort;
    logger: OpsStructuredLogger;
    metrics?: OpsMetricsRegistry;
    now?: () => string;
}

export class OpsFleetEmergencyStop {
    constructor(private readonly options: OpsFleetEmergencyStopOptions) {}

    trigger(reason = 'operator emergency stop'): OpsControlResult {
        const startedAt = Date.now();
        const now = this.options.now?.() ?? new Date().toISOString();
        const failures: OpsFailure[] = [];
        const suspended: string[] = [];
        const [profiles, profilesError] = this.options.presence.list();
        if (profilesError) {
            failures.push({ type: 'COMMAND_FAILED', message: profilesError.type });
        }
        for (const profile of profiles ?? []) {
            const [, suspendError] = this.options.presence.suspend(profile.botId, now);
            if (suspendError) {
                failures.push({ type: 'COMMAND_FAILED', message: suspendError.type });
                continue;
            }
            suspended.push(profile.botId);
        }
        for (const connection of this.options.transport.list()) {
            if (connection.botId === undefined) continue;
            const [, sendError] = this.options.transport.send(
                connection,
                ProtocolEnvelope.create('request', BOT_SAFETY_STOP, {
                    reason,
                }),
            );
            if (sendError) failures.push(this.transportFailure(sendError));
        }
        this.options.metrics?.observe(
            'ops_fleet_emergency_stop_latency_ms',
            Date.now() - startedAt,
        );
        if (failures.length > 0) {
            this.options.metrics?.increment('ops_fleet_emergency_stop_errors_total');
        }
        const [, auditError] = this.options.audit?.append({
            actor: 'operator',
            type: 'ops.fleet-emergency-stop',
            payload: { reason, bots: suspended, failures: failures.length },
        }) ?? [undefined, null];
        if (auditError) {
            this.options.logger.warn({ error: auditError }, 'emergency stop audit failed');
        }
        this.options.logger.warn({ reason, bots: suspended.length }, 'fleet emergency stop');
        return { bots: suspended, failures };
    }

    private transportFailure(failure: TransportFailure | null): OpsFailure {
        return {
            type: 'COMMAND_FAILED',
            message:
                failure === null || !('message' in failure) ? 'command failed' : failure.message,
        };
    }
}

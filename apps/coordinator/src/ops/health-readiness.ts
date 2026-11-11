import type { Result } from '@ticrafter/core';

import type { OpsMetricsRegistry } from './metrics-registry.js';
import type { OpsStatusAggregator } from './status-aggregator.js';
import type { OpsDecisionStatusPort, OpsFailure } from './types.js';

export type OpsHealthState = 'ok' | 'degraded' | 'unavailable';

export interface OpsHealthCheck {
    state: OpsHealthState;
    detail?: string;
}

export interface OpsHealthReport {
    ok: boolean;
    at: string;
    uptimeSeconds: number;
    checks: {
        coordinator: OpsHealthCheck;
        database: OpsHealthCheck;
        model: OpsHealthCheck;
        transport: OpsHealthCheck;
        status: OpsHealthCheck;
    };
}

export interface OpsHealthPorts {
    status: OpsStatusAggregator;
    decisions: OpsDecisionStatusPort;
    database: { ping(): Result<void, string> };
    transport: { isListening(): boolean };
    uptimeSeconds(): number;
    metrics?: OpsMetricsRegistry;
    now?: () => string;
}

export class OpsHealthReadiness {
    constructor(private readonly ports: OpsHealthPorts) {}

    check(): Result<OpsHealthReport, OpsFailure> {
        const startedAt = Date.now();
        const report = this.build();
        this.ports.metrics?.observe('ops_health_readiness_latency_ms', Date.now() - startedAt);
        if (!report.ok) this.ports.metrics?.increment('ops_health_readiness_errors_total');
        return [report, null];
    }

    private build(): OpsHealthReport {
        const [databaseOk, databaseError] = this.ports.database.ping();
        const [status, statusError] = this.ports.status.snapshot();
        const decisions = this.ports.decisions.status();
        const checks = {
            coordinator: { state: 'ok' as const },
            database:
                databaseOk === null
                    ? {
                          state: 'unavailable' as const,
                          detail: databaseError ?? 'database ping failed',
                      }
                    : { state: 'ok' as const },
            model: OpsHealthReadiness.modelCheck(decisions),
            transport: this.ports.transport.isListening()
                ? { state: 'ok' as const }
                : { state: 'unavailable' as const, detail: 'transport is not listening' },
            status:
                statusError || status === null
                    ? {
                          state: 'unavailable' as const,
                          detail: OpsHealthReadiness.describe(statusError),
                      }
                    : { state: 'ok' as const },
        };
        return {
            ok:
                checks.database.state === 'ok' &&
                checks.transport.state === 'ok' &&
                checks.status.state === 'ok',
            at: this.ports.now?.() ?? new Date().toISOString(),
            uptimeSeconds: this.ports.uptimeSeconds(),
            checks,
        };
    }

    private static modelCheck(
        decisions: ReturnType<OpsDecisionStatusPort['status']>,
    ): OpsHealthCheck {
        if (!decisions.enabled) return { state: 'degraded', detail: 'decision service disabled' };
        if (!decisions.modelLoaded) {
            return { state: 'degraded', detail: decisions.failure ?? 'decision model not loaded' };
        }
        return { state: 'ok', detail: decisions.provider };
    }

    private static describe(error: OpsFailure | null): string {
        if (error === null) return 'status unavailable';
        if ('message' in error) return error.message;
        if ('failure' in error) return error.failure.message;
        return error.type;
    }
}

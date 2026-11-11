import { describe, expect, it } from 'bun:test';

import { OpsHealthReadiness } from './health-readiness.js';
import type { OpsStatusAggregator, OpsStatusSnapshot } from './status-aggregator.js';
import type { OpsDecisionStatus } from './types.js';

const status = {
    snapshot: () => [{ at: '2026-11-11T10:00:00.000Z' } as OpsStatusSnapshot, null],
} as unknown as OpsStatusAggregator;

const decision: OpsDecisionStatus = {
    enabled: true,
    provider: 'cpu',
    modelLoaded: true,
    failure: null,
    latency: { samples: 0, p50: 0, p95: 0, fallbackRate: 0 },
};

describe('OpsHealthReadiness', () => {
    it('reports healthy when database, transport, and status are available', () => {
        const health = new OpsHealthReadiness({
            status,
            decisions: { status: () => decision },
            database: { ping: () => [undefined, null] },
            transport: { isListening: () => true },
            uptimeSeconds: () => 10,
        });

        const [report, error] = health.check();

        expect(error).toBeNull();
        expect(report?.ok).toBe(true);
        expect(report?.checks.model.state).toBe('ok');
    });

    it('reports unavailable database and degraded model without hiding other checks', () => {
        const health = new OpsHealthReadiness({
            status,
            decisions: { status: () => ({ ...decision, modelLoaded: false, failure: 'missing' }) },
            database: { ping: () => [null, 'database down'] },
            transport: { isListening: () => true },
            uptimeSeconds: () => 10,
        });

        const [report] = health.check();

        expect(report?.ok).toBe(false);
        expect(report?.checks.database.state).toBe('unavailable');
        expect(report?.checks.model.state).toBe('degraded');
    });
});

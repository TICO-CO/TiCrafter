import { describe, expect, it } from 'bun:test';

import { OpsMetricsRegistry } from './metrics-registry.js';

describe('OpsMetricsRegistry', () => {
    it('records counters, gauges, and histograms with labels', () => {
        const registry = new OpsMetricsRegistry(3);
        registry.increment('ops_errors_total');
        registry.increment('ops_errors_total', 2, { route: '/status' });
        registry.setGauge('ops_online', 4);
        registry.observe('ops_latency_ms', 10);
        registry.observe('ops_latency_ms', 20);

        const snapshot = registry.snapshot();

        expect(snapshot.counters.ops_errors_total).toBe(1);
        expect(snapshot.counters['ops_errors_total{route="/status"}']).toBe(2);
        expect(snapshot.gauges.ops_online).toBe(4);
        expect(snapshot.histograms.ops_latency_ms?.count).toBe(2);
        expect(snapshot.histograms.ops_latency_ms?.p50).toBe(20);
    });

    it('bounds histogram samples', () => {
        const registry = new OpsMetricsRegistry(3);
        registry.observe('ops_latency_ms', 1);
        registry.observe('ops_latency_ms', 2);
        registry.observe('ops_latency_ms', 3);
        registry.observe('ops_latency_ms', 4);

        const snapshot = registry.snapshot();

        expect(snapshot.histograms.ops_latency_ms?.count).toBe(3);
        expect(snapshot.droppedSamples).toBe(1);
    });
});

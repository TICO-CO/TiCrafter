import { describe, expect, it } from 'bun:test';

import { LatencySummary } from './latency-summary.js';

describe('LatencySummary', () => {
    it('computes nearest-rank percentiles', () => {
        const summary = LatencySummary.summarize([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(summary).toEqual({
            p50: 50,
            p95: 100,
            mean: 55,
            min: 10,
            max: 100,
        });
    });

    it('rounds reported statistics', () => {
        const summary = LatencySummary.summarize([1.234, 2.345]);
        expect(summary?.p50).toBe(1.23);
        expect(summary?.mean).toBe(1.79);
    });

    it('returns null for an empty sample', () => {
        expect(LatencySummary.summarize([])).toBeNull();
    });
});

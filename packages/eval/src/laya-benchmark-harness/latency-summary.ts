import type { LatencyStatistics } from './types.js';

export class LatencySummary {
    static summarize(samples: readonly number[]): LatencyStatistics | null {
        if (samples.length === 0) return null;
        const sorted = [...samples].sort((left, right) => left - right);
        return {
            p50: LatencySummary.round(LatencySummary.percentile(sorted, 0.5)),
            p95: LatencySummary.round(LatencySummary.percentile(sorted, 0.95)),
            mean: LatencySummary.round(
                sorted.reduce((total, sample) => total + sample, 0) / sorted.length,
            ),
            min: LatencySummary.round(sorted[0] ?? 0),
            max: LatencySummary.round(sorted[sorted.length - 1] ?? 0),
        };
    }

    private static percentile(sorted: readonly number[], fraction: number): number {
        const rank = Math.ceil(fraction * sorted.length);
        const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
        return sorted[index] ?? 0;
    }

    private static round(value: number): number {
        return Math.round(value * 100) / 100;
    }
}

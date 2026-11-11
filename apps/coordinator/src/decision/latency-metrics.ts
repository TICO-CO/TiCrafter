import type { DecisionProvider } from './types.js';

export interface DecisionLatencySample {
    latencyMilliseconds: number;
    queueWaitMilliseconds: number;
    provider: DecisionProvider;
    fallback: boolean;
}

export interface DecisionLatencySnapshot {
    samples: number;
    p50: number;
    p95: number;
    queueWaitP95: number;
    fallbackRate: number;
    providers: Record<DecisionProvider, number>;
}

export class DecisionLatencyMetrics {
    private readonly samples: DecisionLatencySample[] = [];

    constructor(private readonly maximumSamples = 512) {}

    record(sample: DecisionLatencySample): void {
        this.samples.push(sample);
        if (this.samples.length > this.maximumSamples) this.samples.shift();
    }

    snapshot(): DecisionLatencySnapshot {
        const latencies = this.samples.map((sample) => sample.latencyMilliseconds);
        const queueWaits = this.samples.map((sample) => sample.queueWaitMilliseconds);
        const fallbacks = this.samples.filter((sample) => sample.fallback).length;
        return {
            samples: this.samples.length,
            p50: DecisionLatencyMetrics.percentile(latencies, 0.5),
            p95: DecisionLatencyMetrics.percentile(latencies, 0.95),
            queueWaitP95: DecisionLatencyMetrics.percentile(queueWaits, 0.95),
            fallbackRate: this.samples.length === 0 ? 0 : fallbacks / this.samples.length,
            providers: {
                cpu: this.samples.filter((sample) => sample.provider === 'cpu').length,
                webgpu: this.samples.filter((sample) => sample.provider === 'webgpu').length,
            },
        };
    }

    private static percentile(values: number[], percentile: number): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((left, right) => left - right);
        const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
        return sorted[index] ?? 0;
    }
}

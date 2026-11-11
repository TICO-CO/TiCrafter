export type OpsMetricLabels = Readonly<Record<string, string>>;

export interface OpsHistogramSnapshot {
    count: number;
    sum: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
}

export interface OpsMetricsSnapshot {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, OpsHistogramSnapshot>;
    droppedSamples: number;
}

export class OpsMetricsRegistry {
    private readonly counters = new Map<string, number>();
    private readonly gauges = new Map<string, number>();
    private readonly histograms = new Map<string, number[]>();
    private droppedSamples = 0;

    constructor(private readonly maximumSamples = 512) {}

    increment(name: string, amount = 1, labels: OpsMetricLabels = {}): void {
        const key = OpsMetricsRegistry.key(name, labels);
        this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
    }

    setGauge(name: string, value: number, labels: OpsMetricLabels = {}): void {
        this.gauges.set(OpsMetricsRegistry.key(name, labels), value);
    }

    observe(name: string, value: number, labels: OpsMetricLabels = {}): void {
        const key = OpsMetricsRegistry.key(name, labels);
        const samples = this.histograms.get(key) ?? [];
        samples.push(value);
        if (samples.length > this.maximumSamples) {
            samples.shift();
            this.droppedSamples += 1;
        }
        this.histograms.set(key, samples);
    }

    snapshot(): OpsMetricsSnapshot {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: Object.fromEntries(
                [...this.histograms].map(([key, samples]) => [
                    key,
                    OpsMetricsRegistry.summarize(samples),
                ]),
            ),
            droppedSamples: this.droppedSamples,
        };
    }

    private static key(name: string, labels: OpsMetricLabels): string {
        const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
        if (entries.length === 0) return name;
        return `${name}{${entries.map(([label, value]) => `${label}="${value}"`).join(',')}}`;
    }

    private static summarize(samples: readonly number[]): OpsHistogramSnapshot {
        return {
            count: samples.length,
            sum: samples.reduce((total, sample) => total + sample, 0),
            min: samples.length === 0 ? 0 : Math.min(...samples),
            max: samples.length === 0 ? 0 : Math.max(...samples),
            p50: OpsMetricsRegistry.percentile(samples, 0.5),
            p95: OpsMetricsRegistry.percentile(samples, 0.95),
            p99: OpsMetricsRegistry.percentile(samples, 0.99),
        };
    }

    private static percentile(samples: readonly number[], percentile: number): number {
        if (samples.length === 0) return 0;
        const sorted = [...samples].sort((left, right) => left - right);
        const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
        return sorted[index] ?? 0;
    }
}

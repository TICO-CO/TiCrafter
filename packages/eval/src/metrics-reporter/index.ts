import type { Result } from '@ticrafter/core';

export type MetricKind = 'counter' | 'histogram' | 'gauge';

export interface MetricSample {
    name: string;
    kind: MetricKind;
    labels: Readonly<Record<string, string>>;
    value: number;
}

export interface MetricSummary {
    name: string;
    kind: MetricKind;
    labels: Readonly<Record<string, string>>;
    count: number;
    sum: number;
    minimum: number;
    maximum: number;
    latest: number;
}

export interface EvalMetricsReport {
    generatedAt: string;
    metrics: readonly MetricSummary[];
}

export interface MetricsSink {
    write(report: EvalMetricsReport): Result<void, string>;
}

export class EvalMetrics {
    private readonly samples: MetricSample[] = [];

    increment(name: string, labels: Readonly<Record<string, string>> = {}, by = 1): void {
        this.samples.push({ name, kind: 'counter', labels, value: by });
    }

    observe(name: string, value: number, labels: Readonly<Record<string, string>> = {}): void {
        this.samples.push({ name, kind: 'histogram', labels, value });
    }

    gauge(name: string, value: number, labels: Readonly<Record<string, string>> = {}): void {
        this.samples.push({ name, kind: 'gauge', labels, value });
    }

    snapshot(): readonly MetricSummary[] {
        const grouped = new Map<string, MetricSample[]>();
        this.samples.forEach((sample) => {
            const key = `${sample.name}|${EvalMetrics.labelsKey(sample.labels)}`;
            const existing = grouped.get(key) ?? [];
            existing.push(sample);
            grouped.set(key, existing);
        });
        return [...grouped.values()].map((samples) => EvalMetrics.summarize(samples));
    }

    private static summarize(samples: readonly MetricSample[]): MetricSummary {
        const first = samples[0];
        if (first === undefined) {
            return {
                name: 'unknown',
                kind: 'counter',
                labels: {},
                count: 0,
                sum: 0,
                minimum: 0,
                maximum: 0,
                latest: 0,
            };
        }
        const values = samples.map((sample) => sample.value);
        return {
            name: first.name,
            kind: first.kind,
            labels: first.labels,
            count: values.length,
            sum: values.reduce((total, value) => total + value, 0),
            minimum: Math.min(...values),
            maximum: Math.max(...values),
            latest: values.at(-1) ?? 0,
        };
    }

    private static labelsKey(labels: Readonly<Record<string, string>>): string {
        return Object.entries(labels)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
    }
}

export class MetricsReporter {
    constructor(
        private readonly metrics: EvalMetrics,
        private readonly sink: MetricsSink,
        private readonly now: () => number = Date.now,
    ) {}

    report(): Result<EvalMetricsReport, string> {
        const report: EvalMetricsReport = {
            generatedAt: new Date(this.now()).toISOString(),
            metrics: this.metrics.snapshot(),
        };
        const [written, writeError] = this.sink.write(report);
        if (writeError) return [null, writeError];
        if (written === null) return [null, 'metrics sink returned null'];
        return [report, null];
    }
}

import { describe, expect, it } from 'bun:test';

import { EvalMetrics, type EvalMetricsReport, MetricsReporter } from './index.js';

describe('MetricsReporter', () => {
    it('aggregates samples and writes a report', () => {
        const metrics = new EvalMetrics();
        metrics.increment('claims_total', { bot: 'one' }, 2);
        metrics.observe('claim_latency_ms', 10);
        metrics.observe('claim_latency_ms', 30);
        const reports: EvalMetricsReport[] = [];
        const reporter = new MetricsReporter(
            metrics,
            {
                write: (report) => {
                    reports.push(report);
                    return [undefined, null];
                },
            },
            () => Date.parse('2026-11-11T10:00:00.000Z'),
        );

        const [, reportError] = reporter.report();

        expect(reportError).toBeNull();
        expect(reports[0]?.metrics).toHaveLength(2);
        const latency = reports[0]?.metrics.find((metric) => metric.name === 'claim_latency_ms');
        expect(latency?.count).toBe(2);
        expect(latency?.maximum).toBe(30);
    });
});

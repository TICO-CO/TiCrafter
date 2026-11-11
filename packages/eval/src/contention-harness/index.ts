import type { Result } from '@ticrafter/core';

export interface ContentionAttempt {
    botId: string;
    at: string;
}

export interface ContentionWorkPort {
    attempt(input: ContentionAttempt): Result<boolean, string>;
    active(): number;
}

export interface ContentionOptions {
    botIds: readonly string[];
    attemptsPerBot: number;
    now?: () => number;
}

export interface ContentionReport {
    botCount: number;
    attempts: number;
    successes: number;
    conflicts: number;
    active: number;
    p50Milliseconds: number;
    p95Milliseconds: number;
    finished: boolean;
}

export class ContentionHarness {
    constructor(private readonly work: ContentionWorkPort) {}

    run(options: ContentionOptions): Result<ContentionReport, string> {
        const now = options.now ?? Date.now;
        const latencies: number[] = [];
        let successes = 0;
        let conflicts = 0;
        for (const botId of options.botIds) {
            for (let attempt = 0; attempt < options.attemptsPerBot; attempt += 1) {
                const started = now();
                const [claimed, attemptError] = this.work.attempt({
                    botId,
                    at: new Date(started).toISOString(),
                });
                latencies.push(now() - started);
                if (attemptError) {
                    conflicts += 1;
                } else if (claimed === true) {
                    successes += 1;
                } else {
                    conflicts += 1;
                }
            }
        }
        return [
            {
                botCount: options.botIds.length,
                attempts: latencies.length,
                successes,
                conflicts,
                active: this.work.active(),
                p50Milliseconds: ContentionHarness.percentile(latencies, 0.5),
                p95Milliseconds: ContentionHarness.percentile(latencies, 0.95),
                finished: true,
            },
            null,
        ];
    }

    private static percentile(values: readonly number[], percentile: number): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((left, right) => left - right);
        const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
        return sorted[index] ?? 0;
    }
}

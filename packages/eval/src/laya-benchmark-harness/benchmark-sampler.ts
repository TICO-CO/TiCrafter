import type { Result } from '@ticrafter/core';

import { LatencySummary } from './latency-summary.js';
import type {
    BenchmarkFailure,
    BenchmarkProvider,
    BenchmarkSoakReport,
    LayaBenchmarkFixture,
    LayaModelPort,
    MemoryProbePort,
    MemorySnapshot,
} from './types.js';

export interface TimedMeasurement {
    latencies: number[];
    peakMemory: MemorySnapshot;
    inputTokens: number | null;
}

interface TimedAnswer {
    latency: number;
    inputTokens: number;
}

export interface SoakMeasurement {
    report: BenchmarkSoakReport;
    peakMemory: MemorySnapshot;
}

export class BenchmarkSampler {
    constructor(
        private readonly model: LayaModelPort,
        private readonly memoryProbe: MemoryProbePort,
        private readonly provider: BenchmarkProvider,
        private readonly fixtures: readonly [LayaBenchmarkFixture, ...LayaBenchmarkFixture[]],
    ) {}

    async warmUp(requests: number): Promise<BenchmarkFailure | null> {
        for (let request = 0; request < requests; request += 1) {
            const fixture = this.fixtureAt(request);
            const [, inferenceError] = await this.model.answer(fixture.state, fixture.questions);
            if (inferenceError) return this.failure('INFERENCE_FAILED', inferenceError);
        }
        return null;
    }

    async measure(requests: number): Promise<Result<TimedMeasurement, BenchmarkFailure>> {
        const latencies: number[] = [];
        let peakMemory = this.memoryProbe.snapshot();
        let inputTokens: number | null = null;
        for (let request = 0; request < requests; request += 1) {
            const [answer, inferenceError] = await this.timedAnswer(this.fixtureAt(request));
            if (inferenceError) return [null, this.failure('INFERENCE_FAILED', inferenceError)];
            if (answer === null) return [null, this.failure('INFERENCE_FAILED', 'missing answer')];
            latencies.push(answer.latency);
            inputTokens ??= answer.inputTokens;
            peakMemory = BenchmarkSampler.peak(peakMemory, this.memoryProbe.snapshot());
        }
        return [{ latencies, peakMemory, inputTokens }, null];
    }

    async soak(
        durationMilliseconds: number,
        intervalMilliseconds: number,
    ): Promise<Result<SoakMeasurement | null, BenchmarkFailure>> {
        if (durationMilliseconds <= 0) return [null, null];

        const latencies: number[] = [];
        const deadline = performance.now() + durationMilliseconds;
        let peakMemory = this.memoryProbe.snapshot();
        let request = 0;
        while (performance.now() < deadline) {
            const cycleStart = performance.now();
            const [answer, inferenceError] = await this.timedAnswer(this.fixtureAt(request));
            request += 1;
            if (inferenceError) return [null, this.failure('INFERENCE_FAILED', inferenceError)];
            if (answer === null) return [null, this.failure('INFERENCE_FAILED', 'missing answer')];
            latencies.push(answer.latency);
            peakMemory = BenchmarkSampler.peak(peakMemory, this.memoryProbe.snapshot());
            const remainingMilliseconds = intervalMilliseconds - (performance.now() - cycleStart);
            if (remainingMilliseconds > 0) await BenchmarkSampler.wait(remainingMilliseconds);
        }

        return [
            {
                report: {
                    durationMilliseconds,
                    intervalMilliseconds,
                    samples: latencies.length,
                    completed: true,
                    latency: LatencySummary.summarize(latencies),
                },
                peakMemory,
            },
            null,
        ];
    }

    private async timedAnswer(fixture: LayaBenchmarkFixture): Promise<Result<TimedAnswer, string>> {
        const started = performance.now();
        const [answer, inferenceError] = await this.model.answer(fixture.state, fixture.questions);
        if (inferenceError) return [null, inferenceError];
        if (answer === null) return [null, 'missing answer'];
        return [
            {
                latency: performance.now() - started,
                inputTokens: answer.usage.input_tokens,
            },
            null,
        ];
    }

    private fixtureAt(index: number): LayaBenchmarkFixture {
        return this.fixtures[index % this.fixtures.length] ?? this.fixtures[0];
    }

    private static peak(current: MemorySnapshot, next: MemorySnapshot): MemorySnapshot {
        return {
            rssBytes: Math.max(current.rssBytes, next.rssBytes),
            vramUsedBytes: BenchmarkSampler.maximum(current.vramUsedBytes, next.vramUsedBytes),
            vramTotalBytes: BenchmarkSampler.maximum(current.vramTotalBytes, next.vramTotalBytes),
        };
    }

    private static maximum(left: number | null, right: number | null): number | null {
        if (left === null) return right;
        if (right === null) return left;
        return Math.max(left, right);
    }

    private static wait(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    private failure(kind: BenchmarkFailure['kind'], message: string): BenchmarkFailure {
        return { kind, provider: this.provider, message };
    }
}

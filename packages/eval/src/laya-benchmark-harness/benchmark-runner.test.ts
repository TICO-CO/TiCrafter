import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { LayaBenchmarkRunner } from './benchmark-runner.js';
import type {
    BenchmarkAnswer,
    BenchmarkProvider,
    LayaModelLoaderPort,
    LayaModelPort,
    MemoryProbePort,
    MemorySnapshot,
} from './types.js';

class FakeModel implements LayaModelPort {
    readonly modelDir = '/fake/laya';
    calls = 0;
    closed = false;

    constructor(
        private readonly failOnCall: number | null = null,
        readonly loadedProvider: BenchmarkProvider = 'cpu',
        readonly fallbackReason: string | null = null,
    ) {}

    async answer(): Promise<Result<BenchmarkAnswer, string>> {
        this.calls += 1;
        if (this.calls === this.failOnCall) return [null, 'inference failed'];
        return [{ usage: { input_tokens: 321, output_tokens: 0 } } as BenchmarkAnswer, null];
    }

    async close(): Promise<Result<void, string>> {
        this.closed = true;
        return [undefined, null];
    }
}

class FakeLoader implements LayaModelLoaderPort {
    constructor(private readonly model: LayaModelPort) {}

    async load(): Promise<Result<LayaModelPort, string>> {
        return [this.model, null];
    }
}

class FakeMemoryProbe implements MemoryProbePort {
    private index = 0;

    constructor(private readonly snapshots: readonly MemorySnapshot[]) {}

    snapshot(): MemorySnapshot {
        const snapshot = this.snapshots[this.index] ?? this.snapshots.at(-1);
        this.index += 1;
        if (snapshot === undefined) {
            return { rssBytes: 0, vramUsedBytes: null, vramTotalBytes: null };
        }
        return snapshot;
    }
}

const baseOptions = {
    profile: 'home-full' as const,
    provider: 'cpu' as const,
    fixtureVariant: 'standard' as const,
    threads: 8,
    revision: 'test-revision',
    cacheDir: '/fake/cache',
    modelDir: null,
    warmupRequests: 2,
    measuredRequests: 5,
    soakDurationMilliseconds: 0,
    soakIntervalMilliseconds: 0,
};

describe('LayaBenchmarkRunner', () => {
    it('measures warm requests and reports memory peaks', async () => {
        const model = new FakeModel();
        const probe = new FakeMemoryProbe([
            { rssBytes: 100, vramUsedBytes: 10, vramTotalBytes: 1000 },
            { rssBytes: 200, vramUsedBytes: 20, vramTotalBytes: 1000 },
            { rssBytes: 300, vramUsedBytes: 30, vramTotalBytes: 1000 },
            { rssBytes: 900, vramUsedBytes: 90, vramTotalBytes: 1000 },
            { rssBytes: 400, vramUsedBytes: 40, vramTotalBytes: 1000 },
        ]);
        const runner = new LayaBenchmarkRunner(new FakeLoader(model), probe);
        const [report, runError] = await runner.run(baseOptions);

        expect(runError).toBeNull();
        if (report === null) return;
        expect(model.calls).toBe(7);
        expect(model.closed).toBe(true);
        expect(report.measuredRequests).toBe(5);
        expect(report.inputTokens).toBe(321);
        expect(report.warmupRequests).toBe(2);
        expect(report.memory.rssPeakBytes).toBe(900);
        expect(report.memory.vramPeakBytes).toBe(90);
        expect(report.soak).toBeNull();
        expect(typeof report.latency?.p50).toBe('number');
    });

    it('closes the model when inference fails', async () => {
        const model = new FakeModel(1);
        const probe = new FakeMemoryProbe([
            { rssBytes: 100, vramUsedBytes: null, vramTotalBytes: null },
        ]);
        const runner = new LayaBenchmarkRunner(new FakeLoader(model), probe);
        const [report, failure] = await runner.run({
            ...baseOptions,
            warmupRequests: 0,
            measuredRequests: 1,
        });

        expect(report).toBeNull();
        expect(failure?.kind).toBe('INFERENCE_FAILED');
        expect(model.closed).toBe(true);
    });

    it('reports a provider fallback', async () => {
        const model = new FakeModel(null, 'cpu', 'WebGPU load failed: unavailable');
        const probe = new FakeMemoryProbe([
            { rssBytes: 100, vramUsedBytes: null, vramTotalBytes: null },
        ]);
        const runner = new LayaBenchmarkRunner(new FakeLoader(model), probe);
        const [report, runError] = await runner.run({
            ...baseOptions,
            provider: 'webgpu',
            fixtureVariant: 'compact',
        });

        expect(runError).toBeNull();
        expect(report?.requestedProvider).toBe('webgpu');
        expect(report?.provider).toBe('cpu');
        expect(report?.fallbackReason).toBe('WebGPU load failed: unavailable');
    });

    it('reports model load failures', async () => {
        const loader: LayaModelLoaderPort = {
            async load(): Promise<Result<LayaModelPort, string>> {
                return [null, 'model missing'];
            },
        };
        const runner = new LayaBenchmarkRunner(loader, new FakeMemoryProbe([]));
        const [report, failure] = await runner.run(baseOptions);

        expect(report).toBeNull();
        expect(failure?.kind).toBe('MODEL_LOAD_FAILED');
        expect(failure?.message).toBe('model missing');
    });

    it('rejects invalid measured request counts', async () => {
        const runner = new LayaBenchmarkRunner(
            new FakeLoader(new FakeModel()),
            new FakeMemoryProbe([]),
        );
        const [report, failure] = await runner.run({ ...baseOptions, measuredRequests: 0 });

        expect(report).toBeNull();
        expect(failure?.kind).toBe('INVALID_OPTIONS');
    });
});

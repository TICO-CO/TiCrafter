import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { LayaModelLoader } from './laya-model-adapter.js';
import type {
    BenchmarkAnswer,
    BenchmarkProvider,
    BenchmarkQuestions,
    LayaModelFactoryPort,
    LayaModelLoadOptions,
    LayaModelPort,
} from './types.js';

class ModelStub implements LayaModelPort {
    readonly modelDir = '/fake/laya';

    constructor(
        readonly loadedProvider: BenchmarkProvider,
        readonly fallbackReason: string | null,
    ) {}

    async answer(): Promise<Result<BenchmarkAnswer, string>> {
        return [{ usage: { input_tokens: 1, output_tokens: 0 } } as BenchmarkAnswer, null];
    }

    async close(): Promise<Result<void, string>> {
        return [undefined, null];
    }
}

class FactoryStub implements LayaModelFactoryPort {
    readonly providers: BenchmarkProvider[] = [];

    constructor(private readonly failingProvider: BenchmarkProvider) {}

    async load(
        options: LayaModelLoadOptions,
        fallbackReason: string | null = null,
    ): Promise<Result<LayaModelPort, string>> {
        this.providers.push(options.provider);
        if (options.provider === this.failingProvider) return [null, 'provider unavailable'];
        return [new ModelStub(options.provider, fallbackReason), null];
    }
}

const loadOptions = {
    provider: 'webgpu' as const,
    threads: 8,
    revision: 'test',
    cacheDir: '/fake/cache',
    modelDir: null,
};

describe('LayaModelLoader', () => {
    it('falls back to CPU when WebGPU fails', async () => {
        const factory = new FactoryStub('webgpu');
        const loader = new LayaModelLoader(factory);
        const [model, loadError] = await loader.load({ ...loadOptions, fallbackToCpu: true });

        expect(loadError).toBeNull();
        expect(factory.providers).toEqual(['webgpu', 'cpu']);
        expect(model?.loadedProvider).toBe('cpu');
        expect(model?.fallbackReason?.includes('WebGPU load failed')).toBe(true);
    });

    it('keeps the failure when fallback is disabled', async () => {
        const factory = new FactoryStub('webgpu');
        const loader = new LayaModelLoader(factory);
        const [model, loadError] = await loader.load({ ...loadOptions, fallbackToCpu: false });

        expect(model).toBeNull();
        expect(loadError).toBe('provider unavailable');
        expect(factory.providers).toEqual(['webgpu']);
    });

    it('does not retry CPU when the requested provider is already CPU', async () => {
        const factory = new FactoryStub('cpu');
        const loader = new LayaModelLoader(factory);
        const [model, loadError] = await loader.load({
            ...loadOptions,
            provider: 'cpu',
            fallbackToCpu: true,
        });

        expect(model).toBeNull();
        expect(loadError).toBe('provider unavailable');
        expect(factory.providers).toEqual(['cpu']);
    });
});

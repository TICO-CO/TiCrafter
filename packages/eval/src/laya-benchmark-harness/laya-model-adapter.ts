import type { Laya, LayaOptions } from '@receptron/laya';
import { attemptAsync, type Result } from '@ticrafter/core';

import type {
    BenchmarkAnswer,
    BenchmarkProvider,
    BenchmarkQuestions,
    LayaModelFactoryPort,
    LayaModelLoaderPort,
    LayaModelLoadOptions,
    LayaModelPort,
} from './types.js';

export class LayaModelAdapter implements LayaModelPort {
    private constructor(
        private readonly laya: Laya,
        readonly loadedProvider: BenchmarkProvider,
        readonly fallbackReason: string | null,
    ) {}

    get modelDir(): string {
        return this.laya.modelDir;
    }

    static async load(
        options: LayaModelLoadOptions,
        fallbackReason: string | null = null,
    ): Promise<Result<LayaModelPort, string>> {
        const [module, importError] = await attemptAsync(() => import('@receptron/laya'));
        if (importError) return [null, LayaModelAdapter.describe(importError)];
        if (module === null) return [null, 'Laya module returned null'];

        const [laya, loadError] = await attemptAsync(() =>
            module.Laya.load(LayaModelAdapter.loadOptions(options)),
        );
        if (loadError) return [null, LayaModelAdapter.describe(loadError)];
        if (laya === null) return [null, 'Laya load returned null'];

        return [new LayaModelAdapter(laya, options.provider, fallbackReason), null];
    }

    async answer(
        state: unknown,
        questions: BenchmarkQuestions,
    ): Promise<Result<BenchmarkAnswer, string>> {
        const [answer, answerError] = await attemptAsync(() =>
            this.laya.systemOne(state, questions),
        );
        if (answerError) return [null, LayaModelAdapter.describe(answerError)];
        if (answer === null) return [null, 'Laya systemOne returned null'];
        return [answer, null];
    }

    async close(): Promise<Result<void, string>> {
        const [, closeError] = await attemptAsync(() => this.laya.close());
        if (closeError) return [null, LayaModelAdapter.describe(closeError)];
        return [undefined, null];
    }

    private static loadOptions(options: LayaModelLoadOptions): LayaOptions {
        return {
            executionProviders: LayaModelAdapter.executionProviders(options),
            sessionOptions: {
                intraOpNumThreads: options.threads,
                ...(options.logSeverityLevel !== undefined
                    ? { logSeverityLevel: options.logSeverityLevel }
                    : {}),
            },
            ...(options.modelDir
                ? { modelDir: options.modelDir }
                : { cacheDir: options.cacheDir, revision: options.revision }),
            ...(options.onDownloadProgress ? { onProgress: options.onDownloadProgress } : {}),
        };
    }

    private static executionProviders(
        options: LayaModelLoadOptions,
    ): NonNullable<LayaOptions['executionProviders']> {
        if (options.provider === 'webgpu' && options.webgpu) {
            return [{ name: 'webgpu', ...options.webgpu }];
        }
        return [options.provider];
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class LayaModelLoader implements LayaModelLoaderPort {
    constructor(
        private readonly factory: LayaModelFactoryPort = {
            load: (options, fallbackReason) => LayaModelAdapter.load(options, fallbackReason),
        },
    ) {}

    async load(options: LayaModelLoadOptions): Promise<Result<LayaModelPort, string>> {
        const [model, loadError] = await this.factory.load(options);
        if (loadError === null) return [model, null];
        if (options.provider !== 'webgpu' || options.fallbackToCpu !== true) {
            return [null, loadError];
        }

        const fallbackOptions: LayaModelLoadOptions = {
            ...options,
            provider: 'cpu',
            fallbackToCpu: false,
        };
        const [fallback, fallbackError] = await this.factory.load(
            fallbackOptions,
            `WebGPU load failed: ${loadError}`,
        );
        if (fallbackError) return [null, `${loadError}; CPU fallback failed: ${fallbackError}`];
        if (fallback === null) return [null, `${loadError}; CPU fallback returned null`];
        return [fallback, null];
    }
}

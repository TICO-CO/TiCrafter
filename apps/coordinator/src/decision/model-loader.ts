import type { Laya, LayaOptions } from '@receptron/laya';
import { attemptAsync, type Result } from '@ticrafter/core';

import type {
    DecisionAnswer,
    DecisionModelLoaderPort,
    DecisionModelLoadOptions,
    DecisionModelPort,
    DecisionProvider,
    DecisionQuestions,
    DecisionState,
} from './types.js';

export class DecisionModelAdapter implements DecisionModelPort {
    private constructor(
        private readonly laya: Laya,
        readonly loadedProvider: DecisionProvider,
        readonly fallbackReason: string | null,
    ) {}

    get modelDir(): string {
        return this.laya.modelDir;
    }

    static async load(
        options: DecisionModelLoadOptions,
        fallbackReason: string | null = null,
    ): Promise<Result<DecisionModelPort, string>> {
        const [module, importError] = await attemptAsync(() => import('@receptron/laya'));
        if (importError) return [null, DecisionModelAdapter.describe(importError)];
        if (module === null) return [null, 'Laya module returned null'];

        const [laya, loadError] = await attemptAsync(() =>
            module.Laya.load(DecisionModelAdapter.loadOptions(options)),
        );
        if (loadError) return [null, DecisionModelAdapter.describe(loadError)];
        if (laya === null) return [null, 'Laya load returned null'];

        return [new DecisionModelAdapter(laya, options.provider, fallbackReason), null];
    }

    async answer(
        state: DecisionState,
        questions: DecisionQuestions,
    ): Promise<Result<DecisionAnswer, string>> {
        const [answer, answerError] = await attemptAsync(() =>
            this.laya.systemOne(state, questions),
        );
        if (answerError) return [null, DecisionModelAdapter.describe(answerError)];
        if (answer === null) return [null, 'Laya systemOne returned null'];
        return [answer, null];
    }

    async close(): Promise<Result<void, string>> {
        const [, closeError] = await attemptAsync(() => this.laya.close());
        if (closeError) return [null, DecisionModelAdapter.describe(closeError)];
        return [undefined, null];
    }

    private static loadOptions(options: DecisionModelLoadOptions): LayaOptions {
        return {
            executionProviders: [options.provider],
            sessionOptions: { intraOpNumThreads: options.threads },
            ...(options.modelDirectory.length > 0
                ? { modelDir: options.modelDirectory }
                : { cacheDir: options.cacheDirectory, revision: options.revision }),
        };
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class DecisionModelLoader implements DecisionModelLoaderPort {
    async load(options: DecisionModelLoadOptions): Promise<Result<DecisionModelPort, string>> {
        const [model, loadError] = await DecisionModelAdapter.load(options);
        if (loadError === null) return [model, null];
        if (options.provider !== 'webgpu' || options.fallbackToCpu !== true) {
            return [null, loadError];
        }

        const [fallback, fallbackError] = await DecisionModelAdapter.load(
            { ...options, provider: 'cpu', fallbackToCpu: false },
            `WebGPU load failed: ${loadError}`,
        );
        if (fallbackError) return [null, `${loadError}; CPU fallback failed: ${fallbackError}`];
        if (fallback === null) return [null, `${loadError}; CPU fallback returned null`];
        return [fallback, null];
    }
}

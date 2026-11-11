import type { LoggerPort, Result, TicrafterConfig } from '@ticrafter/core';

import { ExecutionProviderSelector } from './execution-provider-selector.js';
import type {
    DecisionFailure,
    DecisionModelLoaderPort,
    DecisionModelPort,
    DecisionProvider,
} from './types.js';

export class DecisionModelManager {
    private readonly selector: ExecutionProviderSelector;
    private model: DecisionModelPort | null = null;
    private failure: string | null = null;

    constructor(
        private readonly config: TicrafterConfig,
        private readonly logger: LoggerPort,
        private readonly loader: DecisionModelLoaderPort,
    ) {
        this.selector = new ExecutionProviderSelector(config, logger);
    }

    get loadedModel(): DecisionModelPort | null {
        return this.model;
    }

    get provider(): DecisionProvider {
        return this.model?.loadedProvider ?? this.selector.select();
    }

    async ensure(): Promise<Result<DecisionModelPort, DecisionFailure>> {
        if (this.model !== null) return [this.model, null];
        if (this.failure !== null) {
            return [null, { type: 'MODEL_UNAVAILABLE', message: this.failure }];
        }
        const provider = this.selector.select();
        const decision = this.config.decision;
        const [model, loadError] = await this.loader.load({
            provider,
            threads: this.config.laya.threads,
            revision: decision.modelRevision,
            cacheDirectory: decision.cacheDirectory,
            modelDirectory: decision.modelDirectory,
            fallbackToCpu: true,
        });
        if (loadError || model === null) {
            this.failure = loadError ?? 'model loader returned null';
            return [null, { type: 'MODEL_UNAVAILABLE', message: this.failure }];
        }
        if (model.fallbackReason !== null) {
            this.selector.recordFallback(provider, model.loadedProvider, model.fallbackReason);
        }
        this.model = model;
        return [model, null];
    }

    async close(): Promise<void> {
        if (this.model === null) return;
        const [, closeError] = await this.model.close();
        if (closeError) this.logger.warn({ error: closeError }, 'decision model close failed');
        this.model = null;
    }
}

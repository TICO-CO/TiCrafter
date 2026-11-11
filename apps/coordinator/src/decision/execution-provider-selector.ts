import type { LoggerPort, TicrafterConfig } from '@ticrafter/core';

import type { DecisionProvider } from './types.js';

export class ExecutionProviderSelector {
    constructor(
        private readonly config: TicrafterConfig,
        private readonly logger: LoggerPort,
    ) {}

    select(): DecisionProvider {
        const requested = this.config.laya.executionProviders.includes('webgpu') ? 'webgpu' : 'cpu';
        this.logger.debug(
            { requested, available: this.config.laya.executionProviders },
            'decision provider selected',
        );
        return requested;
    }

    recordFallback(requested: DecisionProvider, loaded: DecisionProvider, reason: string): void {
        if (requested === loaded) return;
        this.logger.warn({ requested, loaded, reason }, 'decision execution provider downgraded');
    }
}

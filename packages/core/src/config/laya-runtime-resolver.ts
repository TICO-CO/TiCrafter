import type { ExecutionProvider, TicrafterConfig } from './schema.js';

export interface LayaRuntime {
    executionProviders: ExecutionProvider[];
    threads: number;
}

export class LayaRuntimeResolver {
    static resolve(config: TicrafterConfig): LayaRuntime {
        const executionProviders = [...config.laya.executionProviders];
        if (!executionProviders.includes('cpu')) executionProviders.push('cpu');
        return {
            executionProviders,
            threads: config.laya.threads,
        };
    }
}

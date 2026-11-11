import type { Result } from '@ticrafter/core';

import { DecisionBatchRunner } from './batch-runner.js';
import type { DecisionDigestAssembler } from './digest-assembler.js';
import type { DecisionDigestCache } from './digest-cache.js';
import type { DecisionModelManager } from './model-manager.js';
import type { DecisionOutcomeBuilder } from './outcome-builder.js';
import type { DecisionOutputParser } from './output-parser.js';
import type { DecisionSingleInflightGuard } from './single-inflight-guard.js';
import type { DecisionFailure, DecisionJob, DecisionOutcome } from './types.js';

export interface DecisionWorkerOptions {
    assembler: DecisionDigestAssembler;
    cache: DecisionDigestCache;
    parser: DecisionOutputParser;
    guard: DecisionSingleInflightGuard;
    outcomes: DecisionOutcomeBuilder;
    models: DecisionModelManager;
    timeoutMilliseconds: number;
    now: () => number;
}

export class DecisionWorker {
    constructor(private readonly options: DecisionWorkerOptions) {}

    async process(job: DecisionJob): Promise<Result<DecisionOutcome, DecisionFailure>> {
        const started = this.options.now();
        const queueWait = started - job.createdAt;
        const [model, modelError] = await this.options.models.ensure();
        if (modelError || model === null) {
            return this.options.outcomes.fallback(
                job.request,
                modelError ?? { type: 'MODEL_UNAVAILABLE', message: 'model returned null' },
                this.options.models.provider,
                this.elapsed(job),
                queueWait,
            );
        }
        const [assembled, assembleError] = this.options.assembler.assemble(job.request);
        if (assembleError || assembled === null) {
            return this.options.outcomes.fallback(
                job.request,
                assembleError ?? { type: 'INVALID_OUTPUT', message: 'digest returned null' },
                model.loadedProvider,
                this.elapsed(job),
                queueWait,
            );
        }
        const state = this.options.cache.get(assembled.key) ?? assembled.state;
        this.options.cache.set(assembled.key, state);
        const runner = new DecisionBatchRunner(model);
        const [result, inferenceError] = await this.options.guard.run(
            () => runner.run(state, job.request.affordances),
            this.options.timeoutMilliseconds,
        );
        if (inferenceError) {
            return this.options.outcomes.fallback(
                job.request,
                inferenceError,
                model.loadedProvider,
                this.elapsed(job),
                queueWait,
            );
        }
        if (result === null || result[1] !== null) {
            return this.options.outcomes.fallback(
                job.request,
                {
                    type: 'INFERENCE_FAILED',
                    message: result?.[1] ?? 'batch runner returned null',
                },
                model.loadedProvider,
                this.elapsed(job),
                queueWait,
            );
        }
        const [parsed, parseError] = this.options.parser.parse(result[0]);
        if (parseError || parsed === null) {
            return this.options.outcomes.fallback(
                job.request,
                parseError ?? { type: 'INVALID_OUTPUT', message: 'parser returned null' },
                model.loadedProvider,
                this.elapsed(job),
                queueWait,
            );
        }
        return this.options.outcomes.success(job, parsed, model.loadedProvider, started);
    }

    private elapsed(job: DecisionJob): number {
        return this.options.now() - job.createdAt;
    }
}

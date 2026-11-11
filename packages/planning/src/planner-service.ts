import type { Result } from '@ticrafter/core';

import type { PlannerArbitrationHandler } from './arbitration-handler.js';
import type { PlannerContextBuilder } from './context-builder.js';
import type { PlannerFailure } from './failures.js';
import type { PlannerKeepLastGoodFallback } from './keep-last-good-fallback.js';
import type { PlannerPlanCache } from './plan-cache.js';
import type { PlannerPlan } from './plan-schema.js';
import type { PlannerRepairLoop } from './repair-loop.js';
import type { PlannerSipMutationTranslator } from './sip-mutation-translator.js';
import type { PlannerTaskDagTranslator } from './task-dag-translator.js';
import type {
    PlannerArbitrationRequest,
    PlannerArbitrationResult,
    PlannerContext,
    PlannerCycleResult,
    PlannerSipProposalInput,
    PlannerTaskProposal,
    PlannerTrigger,
    PlannerUsage,
} from './types.js';

export interface PlannerServiceOptions {
    enabled: boolean;
    contextBuilder: PlannerContextBuilder;
    repairLoop: PlannerRepairLoop;
    cache: PlannerPlanCache;
    keepLastGood: PlannerKeepLastGoodFallback;
    sipTranslator: PlannerSipMutationTranslator;
    taskTranslator: PlannerTaskDagTranslator;
    arbitration: PlannerArbitrationHandler;
}

export class PlannerService {
    constructor(private readonly options: PlannerServiceOptions) {}

    async plan(
        trigger: PlannerTrigger,
        signal: AbortSignal = new AbortController().signal,
    ): Promise<Result<PlannerCycleResult, PlannerFailure>> {
        if (!this.options.enabled) {
            return [null, { type: 'DISABLED', message: 'planner is disabled' }];
        }
        const [prompt, contextError] = this.options.contextBuilder.build(trigger);
        if (contextError) return [null, contextError];
        if (prompt === null) {
            return [null, { type: 'CONTEXT', message: 'planner context missing' }];
        }
        const [repaired, repairError] = await this.options.repairLoop.run(
            prompt,
            prompt.context,
            signal,
        );
        if (repairError) return this.fallback(prompt.context, repairError);
        if (repaired === null) {
            return [null, { type: 'TRANSLATION', message: 'planner repair outcome missing' }];
        }
        const [saved, saveError] = this.options.cache.save(repaired.plan, prompt.contextHash);
        if (saveError) return [null, saveError];
        if (saved === null)
            return [
                null,
                { type: 'CACHE', failure: { type: 'WRITE_FAILED', message: 'plan not saved' } },
            ];
        const [, recordError] = this.options.cache.recordResponses(
            repaired.plan.planId,
            repaired.responses,
        );
        if (recordError) return [null, recordError];
        const [, pruneError] = this.options.cache.prune(50, 200);
        if (pruneError) return [null, pruneError];
        const [sipProposal, taskProposals, translationError] = this.translate(
            repaired.plan,
            prompt.context,
        );
        return [
            {
                source: 'planner',
                plan: repaired.plan,
                applicable: true,
                sipProposal,
                taskProposals,
                taskCancellations: translationError === null ? repaired.plan.cancelTaskIds : [],
                attempts: repaired.attempts,
                usage: repaired.usage,
                failure: translationError,
            },
            null,
        ];
    }

    async arbitrate(
        request: PlannerArbitrationRequest,
        signal: AbortSignal = new AbortController().signal,
    ): Promise<Result<PlannerArbitrationResult, PlannerFailure>> {
        if (!this.options.enabled) {
            return [null, { type: 'DISABLED', message: 'planner is disabled' }];
        }
        return this.options.arbitration.decide(request, signal);
    }

    private fallback(
        context: PlannerContext,
        failure: PlannerFailure,
    ): Result<PlannerCycleResult, PlannerFailure> {
        const [lastGood, lastGoodError] = this.options.keepLastGood.load(context.sip.revision);
        if (lastGoodError) {
            return [
                {
                    source: 'none',
                    plan: null,
                    applicable: false,
                    sipProposal: null,
                    taskProposals: [],
                    taskCancellations: [],
                    attempts: 0,
                    usage: PlannerService.zeroUsage(),
                    failure,
                },
                null,
            ];
        }
        if (lastGood === null) {
            return [
                {
                    source: 'none',
                    plan: null,
                    applicable: false,
                    sipProposal: null,
                    taskProposals: [],
                    taskCancellations: [],
                    attempts: 0,
                    usage: PlannerService.zeroUsage(),
                    failure,
                },
                null,
            ];
        }
        const [sipProposal, taskProposals] = lastGood.applicable
            ? this.translate(lastGood.plan, context)
            : [null, [], null];
        return [
            {
                source: 'last-good',
                plan: lastGood.plan,
                applicable: lastGood.applicable,
                sipProposal,
                taskProposals,
                taskCancellations: [],
                attempts: 0,
                usage: PlannerService.zeroUsage(),
                failure,
            },
            null,
        ];
    }

    private translate(
        plan: PlannerPlan,
        context: PlannerContext,
    ): [PlannerSipProposalInput | null, readonly PlannerTaskProposal[], PlannerFailure | null] {
        const [sipProposal, sipError] = this.options.sipTranslator.translate(plan, context);
        if (sipError) return [null, [], sipError];
        const [taskProposals, taskError] = this.options.taskTranslator.translate(plan);
        if (taskError) return [sipProposal, [], taskError];
        return [sipProposal, taskProposals ?? [], null];
    }

    private static zeroUsage(): PlannerUsage {
        return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
}

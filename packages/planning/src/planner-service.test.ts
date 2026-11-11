import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { PlannerArbitrationHandler } from './arbitration-handler.js';
import { PlannerBudgetLimiter } from './budget-limiter.js';
import { PlannerContextBuilder } from './context-builder.js';
import { PlannerKeepLastGoodFallback } from './keep-last-good-fallback.js';
import { OpenAiPlannerClient } from './openai-client.js';
import { PlannerPlanCache } from './plan-cache.js';
import { PlannerService } from './planner-service.js';
import {
    FakePlannerContextSource,
    plannerContext,
    plannerPlan,
    plannerTrigger,
} from './planning-fixture.js';
import { PlannerRepairLoop } from './repair-loop.js';
import { PlannerSchemaValidator } from './schema-validator.js';
import { PlannerSemanticValidator } from './semantic-validator.js';
import { PlannerSipMutationTranslator } from './sip-mutation-translator.js';
import { PlannerTaskDagTranslator } from './task-dag-translator.js';
import type {
    PlannerHttpPort,
    PlannerHttpRequest,
    PlannerHttpResponse,
    PlannerPlanStorePort,
    PlannerSipProposalInput,
} from './types.js';

class SequenceHttpPort implements PlannerHttpPort {
    private index = 0;

    constructor(private readonly contents: readonly string[]) {}

    async post(_request: PlannerHttpRequest): Promise<Result<PlannerHttpResponse, string>> {
        const content = this.contents[this.index] ?? this.contents[this.contents.length - 1] ?? '';
        this.index += 1;
        return [
            {
                status: 200,
                bodyText: JSON.stringify({ choices: [{ message: { content } }] }),
            },
            null,
        ];
    }
}

class FakePlanStore implements PlannerPlanStorePort {
    plans: {
        id: string;
        revision: number;
        contextHash: string | null;
        planJson: string;
        createdAt: string;
    }[] = [];

    savePlan(record: {
        id: string;
        revision: number;
        contextHash: string | null;
        planJson: string;
        createdAt: string;
    }): Result<void, StorageFailure> {
        this.plans = this.plans.filter((plan) => plan.id !== record.id);
        this.plans.push(record);
        return [undefined, null];
    }

    latestPlan(): Result<
        {
            id: string;
            revision: number;
            contextHash: string | null;
            planJson: string;
            createdAt: string;
        } | null,
        StorageFailure
    > {
        const plan = [...this.plans].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
        )[0];
        return [plan ?? null, null];
    }

    appendResponse(_record: {
        planId: string | null;
        status: 'success' | 'failure';
        content: string;
        error: string | null;
        createdAt: string;
    }): Result<void, StorageFailure> {
        return [undefined, null];
    }

    prune(_planLimit: number, _responseLimit: number): Result<void, StorageFailure> {
        return [undefined, null];
    }
}

function service(
    contents: readonly string[],
    store = new FakePlanStore(),
    enabled = true,
): {
    service: PlannerService;
    store: FakePlanStore;
} {
    const schema = new PlannerSchemaValidator();
    const http = new SequenceHttpPort(contents);
    const client = new OpenAiPlannerClient({
        baseUrl: 'https://planner.invalid',
        apiKey: 'secret',
        model: 'test-model',
        http,
        timeoutMilliseconds: 1_000,
    });
    const budget = new PlannerBudgetLimiter({ callsPerMinute: 20, maxTokensPerCall: 20_000 });
    const semantic = new PlannerSemanticValidator({
        skills: { has: (skillId) => skillId === 'navigate' },
        sip: { validate: () => [undefined, null] },
    });
    const cache = new PlannerPlanCache({ store, schemaValidator: schema });
    return {
        service: new PlannerService({
            enabled,
            contextBuilder: new PlannerContextBuilder({
                source: new FakePlannerContextSource(plannerContext({ tasks: [], inventory: {} })),
                maxContextCharacters: 48_000,
            }),
            repairLoop: new PlannerRepairLoop({
                client,
                schemaValidator: schema,
                semanticValidator: semantic,
                budgetLimiter: budget,
                maxRepairAttempts: 2,
                maxOutputTokens: 2_000,
            }),
            cache,
            keepLastGood: new PlannerKeepLastGoodFallback(cache),
            sipTranslator: new PlannerSipMutationTranslator({
                propose: (input: PlannerSipProposalInput) => [input, null],
            }),
            taskTranslator: new PlannerTaskDagTranslator({ validate: () => [undefined, null] }),
            arbitration: new PlannerArbitrationHandler({
                client,
                budgetLimiter: budget,
                maxOutputTokens: 2_000,
            }),
        }),
        store,
    };
}

describe('PlannerService', () => {
    it('returns disabled when configured off', async () => {
        const [, serviceError] = await service([], new FakePlanStore(), false).service.plan(
            plannerTrigger(),
        );
        expect(serviceError?.type).toBe('DISABLED');
    });

    it('produces proposals and caches the validated plan', async () => {
        const plan = plannerPlan();
        const { service: plannerService, store } = service([JSON.stringify(plan)]);
        const [cycle, cycleError] = await plannerService.plan(plannerTrigger());
        expect(cycleError).toBeNull();
        expect(cycle?.source).toBe('planner');
        expect(cycle?.plan?.planId).toBe('plan-1');
        expect(cycle?.taskProposals[0]?.id).toBe('task-1');
        expect(store.plans[0]?.id).toBe('plan-1');
    });

    it('falls back to the last good plan after repair exhaustion', async () => {
        const store = new FakePlanStore();
        const seed = service([JSON.stringify(plannerPlan())], store);
        await seed.service.plan(plannerTrigger());
        const { service: failing } = service(['{}', '{}', '{}'], store);
        const [cycle, cycleError] = await failing.plan(plannerTrigger());
        expect(cycleError).toBeNull();
        expect(cycle?.source).toBe('last-good');
        expect(cycle?.applicable).toBe(true);
        expect(cycle?.failure?.type).toBe('REPAIR_EXHAUSTED');
    });
});

import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { PlannerKeepLastGoodFallback } from './keep-last-good-fallback.js';
import { PlannerPlanCache } from './plan-cache.js';
import { plannerPlan } from './planning-fixture.js';
import { PlannerSchemaValidator } from './schema-validator.js';
import type { PlannerPlanStorePort } from './types.js';

interface StoredPlan {
    id: string;
    revision: number;
    contextHash: string | null;
    planJson: string;
    createdAt: string;
}

class FakePlanStore implements PlannerPlanStorePort {
    plans: StoredPlan[] = [];
    responses: {
        planId: string | null;
        status: 'success' | 'failure';
        content: string;
        error: string | null;
        createdAt: string;
    }[] = [];

    savePlan(record: StoredPlan): Result<void, StorageFailure> {
        this.plans = this.plans.filter((plan) => plan.id !== record.id);
        this.plans.push(record);
        return [undefined, null];
    }

    latestPlan(): Result<StoredPlan | null, StorageFailure> {
        const plan = [...this.plans].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
        )[0];
        return [plan ?? null, null];
    }

    appendResponse(record: {
        planId: string | null;
        status: 'success' | 'failure';
        content: string;
        error: string | null;
        createdAt: string;
    }): Result<void, StorageFailure> {
        this.responses.push(record);
        return [undefined, null];
    }

    prune(_planLimit: number, _responseLimit: number): Result<void, StorageFailure> {
        return [undefined, null];
    }
}

function cache(store: FakePlanStore): PlannerPlanCache {
    return new PlannerPlanCache({
        store,
        schemaValidator: new PlannerSchemaValidator(),
        now: () => 1_000,
    });
}

describe('PlannerPlanCache', () => {
    it('saves and loads validated plans', () => {
        const store = new FakePlanStore();
        const planCache = cache(store);
        const [, saveError] = planCache.save(plannerPlan(), 'hash-1');
        expect(saveError).toBeNull();
        const [entry, readError] = planCache.latest();
        expect(readError).toBeNull();
        expect(entry?.plan.planId).toBe('plan-1');
        expect(entry?.contextHash).toBe('hash-1');
    });

    it('returns the last good plan only when the revision matches', () => {
        const store = new FakePlanStore();
        const planCache = cache(store);
        planCache.save(plannerPlan(), 'hash-1');
        const fallback = new PlannerKeepLastGoodFallback(planCache);
        const [current, currentError] = fallback.load(5);
        expect(currentError).toBeNull();
        expect(current?.applicable).toBe(true);
        const [stale, staleError] = fallback.load(6);
        expect(staleError).toBeNull();
        expect(stale?.applicable).toBe(false);
    });

    it('records raw responses', () => {
        const store = new FakePlanStore();
        const planCache = cache(store);
        const [, recordError] = planCache.recordResponses('plan-1', [
            {
                content: '{}',
                failure: { type: 'SCHEMA', issues: ['bad plan'] },
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
        ]);
        expect(recordError).toBeNull();
        expect(store.responses[0]?.status).toBe('failure');
    });
});

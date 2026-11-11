import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { PlannerFailure } from './failures.js';
import type { PlannerPlan } from './plan-schema.js';
import type { PlannerSchemaValidator } from './schema-validator.js';
import type { PlannerPlanCacheEntry, PlannerPlanStorePort, PlannerRawResponse } from './types.js';

export interface PlannerPlanCacheOptions {
    store: PlannerPlanStorePort;
    schemaValidator: PlannerSchemaValidator;
    now?: () => number;
}

export class PlannerPlanCache {
    constructor(private readonly options: PlannerPlanCacheOptions) {}

    save(plan: PlannerPlan, contextHash: string): Result<void, PlannerFailure> {
        const [saved, saveError] = this.options.store.savePlan({
            id: plan.planId,
            revision: plan.baseRevision,
            contextHash,
            planJson: JSON.stringify(plan),
            createdAt: new Date(this.now()).toISOString(),
        });
        if (saveError) return [null, PlannerPlanCache.cacheFailure(saveError)];
        if (saved === null) return [undefined, null];
        return [undefined, null];
    }

    latest(): Result<PlannerPlanCacheEntry, PlannerFailure> {
        const [record, readError] = this.options.store.latestPlan();
        if (readError) return [null, PlannerPlanCache.cacheFailure(readError)];
        if (record === null) {
            return [
                null,
                { type: 'CACHE', failure: { type: 'READ_FAILED', message: 'no cached plan' } },
            ];
        }
        const [plan, planError] = this.options.schemaValidator.validate(record.planJson);
        if (planError) return [null, planError];
        if (plan === null) {
            return [
                null,
                { type: 'CACHE', failure: { type: 'READ_FAILED', message: 'cached plan missing' } },
            ];
        }
        return [
            {
                plan,
                revision: record.revision,
                contextHash: record.contextHash,
                createdAt: record.createdAt,
            },
            null,
        ];
    }

    recordResponses(
        planId: string | null,
        responses: readonly PlannerRawResponse[],
    ): Result<void, PlannerFailure> {
        const createdAt = new Date(this.now()).toISOString();
        for (const response of responses) {
            const [saved, saveError] = this.options.store.appendResponse({
                planId,
                status: response.failure === null ? 'success' : 'failure',
                content: response.content,
                error:
                    response.failure === null
                        ? null
                        : PlannerPlanCache.failureText(response.failure),
                createdAt,
            });
            if (saveError) return [null, PlannerPlanCache.cacheFailure(saveError)];
            if (saved === null) return [undefined, null];
        }
        return [undefined, null];
    }

    prune(planLimit: number, responseLimit: number): Result<void, PlannerFailure> {
        const [pruned, pruneError] = this.options.store.prune(planLimit, responseLimit);
        if (pruneError) return [null, PlannerPlanCache.cacheFailure(pruneError)];
        if (pruned === null) return [undefined, null];
        return [undefined, null];
    }

    private now(): number {
        return this.options.now?.() ?? Date.now();
    }

    private static cacheFailure(failure: StorageFailure): PlannerFailure {
        return { type: 'CACHE', failure };
    }

    private static failureText(failure: PlannerFailure): string {
        switch (failure.type) {
            case 'SCHEMA':
            case 'SEMANTIC':
                return failure.issues.join('; ');
            case 'REPAIR_EXHAUSTED':
                return PlannerPlanCache.failureText(failure.failure);
            case 'BUDGET':
            case 'CACHE':
            case 'CONTEXT':
            case 'TRANSPORT':
            case 'HTTP':
            case 'MALFORMED_RESPONSE':
            case 'MISSING_ENDPOINT':
            case 'DISABLED':
            case 'TRANSLATION':
            case 'ARBITRATION':
                return failure.type;
        }
    }
}

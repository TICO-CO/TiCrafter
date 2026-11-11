import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import type { PlannerPlanCache } from './plan-cache.js';
import type { PlannerPlanCacheEntry } from './types.js';

export interface PlannerLastGoodPlan {
    plan: PlannerPlanCacheEntry['plan'];
    applicable: boolean;
    reason: string;
}

export class PlannerKeepLastGoodFallback {
    constructor(private readonly cache: PlannerPlanCache) {}

    load(currentRevision: number): Result<PlannerLastGoodPlan, PlannerFailure> {
        const [entry, cacheError] = this.cache.latest();
        if (cacheError) return [null, cacheError];
        if (entry === null) {
            return [
                null,
                {
                    type: 'CACHE',
                    failure: { type: 'READ_FAILED', message: 'no last good plan' },
                },
            ];
        }
        if (entry.plan.baseRevision !== currentRevision) {
            return [
                {
                    plan: entry.plan,
                    applicable: false,
                    reason: `cached plan revision ${entry.plan.baseRevision} is stale`,
                },
                null,
            ];
        }
        return [
            {
                plan: entry.plan,
                applicable: true,
                reason: 'last validated plan restored',
            },
            null,
        ];
    }
}

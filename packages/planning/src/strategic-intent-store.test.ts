import type { StrategicIntent } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import {
    type PlannerCycleResult,
    PlannerPlanCache,
    plannerPlanSchema,
    type PlannerPlanStorePort,
    PlannerSchemaValidator,
} from '@ticrafter/planning';
import { describe, expect, it } from 'bun:test';

import { StrategicIntentStore } from './strategic-intent-store.js';

interface StoredPlan {
    id: string;
    revision: number;
    contextHash: string | null;
    planJson: string;
    createdAt: string;
}

class MemoryPlanStore implements PlannerPlanStorePort {
    plans: StoredPlan[] = [];

    savePlan(record: StoredPlan): [undefined | null, StorageFailure | null] {
        this.plans.push(record);
        return [undefined, null];
    }

    latestPlan(): [StoredPlan | null, StorageFailure | null] {
        return [this.plans[this.plans.length - 1] ?? null, null];
    }

    appendResponse(): [undefined, null] {
        return [undefined, null];
    }

    prune(): [undefined, null] {
        return [undefined, null];
    }
}

const intent: StrategicIntent = {
    planId: 'plan-1',
    primaryGoal: { kind: 'gather', weight: 0.5 },
    secondaryGoals: [],
    constraints: ['prioritize-safety'],
    perBot: [
        {
            botId: 'bot-1',
            priorityModifiers: { gather: 0.2 },
            constraints: ['prefer-local-work'],
        },
    ],
};

const plan = plannerPlanSchema.parse({
    schemaVersion: 1,
    planId: 'plan-1',
    baseRevision: 5,
    goals: [{ id: 'goal-1', description: 'Gather', priority: 1, status: 'active' }],
    sipMutations: [],
    tasks: [],
    blueprints: [],
    strategicIntent: intent,
    recovery: { mode: 'continue', notes: '' },
    notes: '',
});

function cache(): PlannerPlanCache {
    return new PlannerPlanCache({
        store: new MemoryPlanStore(),
        schemaValidator: new PlannerSchemaValidator(),
    });
}

function cycleWith(intentValue: StrategicIntent | undefined): PlannerCycleResult {
    return {
        source: 'planner',
        plan: { ...plan, strategicIntent: intentValue },
        applicable: true,
        sipProposal: null,
        taskProposals: [],
        taskCancellations: [],
        attempts: 1,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        failure: null,
    };
}

describe('StrategicIntentStore', () => {
    it('hydrates from the latest cached plan', () => {
        const plannerCache = cache();
        plannerCache.save(plan, 'hash');
        const store = new StrategicIntentStore();
        const [, hydrateError] = store.hydrate(plannerCache);
        expect(hydrateError).toBeNull();
        expect(store.current()?.planId).toBe('plan-1');
    });

    it('updates once per plan and merges per-bot constraints', () => {
        const store = new StrategicIntentStore();
        expect(store.updateFromCycle(cycleWith(intent))).toBe(true);
        expect(store.updateFromCycle(cycleWith(intent))).toBe(false);
        expect(store.forBot('bot-1')?.constraints).toEqual([
            'prioritize-safety',
            'prefer-local-work',
        ]);
        expect(store.forBot('bot-2')?.planId).toBe('plan-1');
    });
});

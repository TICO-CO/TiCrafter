import { afterEach, describe, expect, it } from 'bun:test';

import { SqlitePlannerPlanStore } from './planner-plan-store.js';
import { TestDatabase } from './test-database.js';

afterEach(() => {
    TestDatabase.cleanup();
});

describe('SqlitePlannerPlanStore', () => {
    it('stores and loads the latest validated plan', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new SqlitePlannerPlanStore(database);

        const [, firstError] = store.savePlan({
            id: 'plan-1',
            revision: 3,
            contextHash: 'hash-1',
            planJson: '{"planId":"plan-1"}',
            createdAt: '2026-11-11T12:00:00.000Z',
        });
        expect(firstError).toBeNull();

        const [, secondError] = store.savePlan({
            id: 'plan-2',
            revision: 4,
            contextHash: null,
            planJson: '{"planId":"plan-2"}',
            createdAt: '2026-11-11T12:01:00.000Z',
        });
        expect(secondError).toBeNull();

        const [latest, latestError] = store.latestPlan();
        expect(latestError).toBeNull();
        expect(latest?.id).toBe('plan-2');
        expect(latest?.revision).toBe(4);
        database.close();
    });

    it('records responses and prunes old rows', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new SqlitePlannerPlanStore(database);

        const [, writeError] = store.savePlan({
            id: 'plan-1',
            revision: 1,
            contextHash: null,
            planJson: '{}',
            createdAt: '2026-11-11T12:00:00.000Z',
        });
        expect(writeError).toBeNull();

        const [, responseError] = store.appendResponse({
            planId: 'plan-1',
            status: 'failure',
            content: 'invalid',
            error: 'schema mismatch',
            createdAt: '2026-11-11T12:00:00.000Z',
        });
        expect(responseError).toBeNull();

        const [responses, readError] = store.recentResponses(10);
        expect(readError).toBeNull();
        expect(responses?.length).toBe(1);
        expect(responses?.[0]?.error).toBe('schema mismatch');

        const [, pruneError] = store.prune(0, 0);
        expect(pruneError).toBeNull();

        const [remainingPlans, planError] = store.latestPlan();
        expect(planError).toBeNull();
        expect(remainingPlans).toBeNull();
        database.close();
    });
});

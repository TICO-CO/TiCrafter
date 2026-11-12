import type { StorageFailure } from '@ticrafter/memory';

export type ConstructionPlanFailure =
    { type: 'INVALID_PLAN'; message: string } | { type: 'STORAGE'; failure: StorageFailure };

export class ConstructionPlanFailures {
    static invalidPlan(message: string): ConstructionPlanFailure {
        return { type: 'INVALID_PLAN', message };
    }

    static storage(failure: StorageFailure): ConstructionPlanFailure {
        return { type: 'STORAGE', failure };
    }
}

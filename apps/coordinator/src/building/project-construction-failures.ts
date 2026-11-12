import type { BuildingFailure } from '@ticrafter/building';

export type ProjectConstructionFailure =
    | { type: 'BLUEPRINT_FAILED'; failure: BuildingFailure }
    | { type: 'SITE_UNAVAILABLE'; message: string }
    | { type: 'PLAN_FAILED'; failure: BuildingFailure }
    | { type: 'STORAGE'; message: string };

export class ProjectConstructionFailures {
    static blueprintFailed(failure: BuildingFailure): ProjectConstructionFailure {
        return { type: 'BLUEPRINT_FAILED', failure };
    }

    static siteUnavailable(message: string): ProjectConstructionFailure {
        return { type: 'SITE_UNAVAILABLE', message };
    }

    static invalidPlan(message: string): ProjectConstructionFailure {
        return { type: 'PLAN_FAILED', failure: { type: 'INVALID_CONSTRUCTION_PLAN', message } };
    }

    static planFailed(failure: BuildingFailure): ProjectConstructionFailure {
        return { type: 'PLAN_FAILED', failure };
    }

    static storage(message: string): ProjectConstructionFailure {
        return { type: 'STORAGE', message };
    }
}

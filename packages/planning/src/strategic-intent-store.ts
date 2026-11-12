import type { Result, StrategicIntent } from '@ticrafter/core';

import type { PlannerPlanCache } from './plan-cache.js';
import type { PlannerCycleResult } from './types.js';

export class StrategicIntentStore {
    private intent: StrategicIntent | null = null;

    hydrate(cache: PlannerPlanCache): Result<void, string> {
        const [entry, error] = cache.latest();
        if (error) return [null, error.type];
        this.intent = entry?.plan.strategicIntent ?? null;
        return [undefined, null];
    }

    updateFromCycle(cycle: PlannerCycleResult): boolean {
        const intent = cycle.plan?.strategicIntent;
        if (intent === undefined || intent === null) return false;
        if (this.intent?.planId === intent.planId) return false;
        this.intent = intent;
        return true;
    }

    current(): StrategicIntent | null {
        return this.intent;
    }

    forBot(botId: string): StrategicIntent | null {
        if (this.intent === null) return null;
        const override = this.intent.perBot.find((entry) => entry.botId === botId);
        if (override === undefined) return this.intent;
        return {
            ...this.intent,
            constraints: [...new Set([...this.intent.constraints, ...override.constraints])],
            perBot: [override],
        };
    }
}

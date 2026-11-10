import type { Result } from '@ticrafter/core';

import type { Affordance } from './affordance-enumerator.js';

export interface PolicyState {
    health: number;
    food: number;
    nearestHostileDistance: number | null;
    inventoryUsedRatio: number;
}

export class DeterministicPolicy {
    select(
        affordances: readonly Affordance[],
        state: PolicyState,
    ): Result<Affordance | null, string> {
        if (affordances.length === 0) return [null, null];
        const scored = affordances.map((affordance) => ({
            affordance,
            score: this.score(affordance, state),
        }));
        const best = scored.reduce((current, candidate) =>
            candidate.score > current.score ? candidate : current,
        );
        return [best.affordance, null];
    }

    private score(affordance: Affordance, state: PolicyState): number {
        let score = affordance.priority * 100;
        if (affordance.skillId === 'flee-defend') score += this.threatScore(state);
        if (affordance.skillId === 'eat') score += Math.max(0, 20 - state.food) * 2;
        if (affordance.skillId === 'deposit') score += state.inventoryUsedRatio * 20;
        if (state.health < 8) score += 50;
        return score;
    }

    private threatScore(state: PolicyState): number {
        if (state.nearestHostileDistance === null) return 0;
        return 100 / (state.nearestHostileDistance + 1);
    }
}

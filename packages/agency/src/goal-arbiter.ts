import type { Result } from '@ticrafter/core';

import type { NeedsModel } from './needs-model.js';
import type { PersonalityModel } from './personality-model.js';
import type { Goal, GoalKind, Intention, NeedName } from './types.js';

const KIND_NEEDS: Readonly<Record<GoalKind, NeedName>> = {
    survive: 'safety',
    eat: 'hunger',
    rest: 'rest',
    gather: 'materials',
    craft: 'tools',
    shelter: 'shelter',
    explore: 'novelty',
    social: 'social',
    'return-home': 'shelter',
    deposit: 'achievement',
    leisure: 'novelty',
};

export function goalNeedFor(kind: GoalKind): NeedName {
    return KIND_NEEDS[kind];
}

const CLOSE_SCORE = 0.12;
const DEFAULT_COMMITMENT_BONUS = 0.15;

export interface GoalArbiterOptions {
    commitmentBonus?: number;
}

export interface GoalSelection {
    goal: Goal;
    score: number;
    layaShouldAdvise: boolean;
}

export class GoalArbiter {
    private readonly commitmentBonus: number;

    private constructor(options: GoalArbiterOptions) {
        this.commitmentBonus = options.commitmentBonus ?? DEFAULT_COMMITMENT_BONUS;
    }

    static create(options: GoalArbiterOptions = {}): Result<GoalArbiter, string> {
        const commitmentBonus = options.commitmentBonus ?? DEFAULT_COMMITMENT_BONUS;
        if (!Number.isFinite(commitmentBonus) || commitmentBonus < 0 || commitmentBonus > 1) {
            return [null, 'commitmentBonus must be between 0 and 1'];
        }
        return [new GoalArbiter(options), null];
    }

    select(
        goals: readonly Goal[],
        needs: NeedsModel,
        personality: PersonalityModel,
        intention: Intention | null,
    ): Result<GoalSelection, string> {
        if (goals.length === 0) return [null, 'no goals to arbitrate'];
        const scored = goals
            .map((goal) => ({
                goal,
                score: this.score(goal, needs, personality, intention),
            }))
            .sort((first, second) => second.score - first.score);
        const best = scored[0];
        const runnerUp = scored[1];
        if (best === undefined) return [null, 'goal scores missing'];
        return [
            {
                goal: best.goal,
                score: best.score,
                layaShouldAdvise:
                    runnerUp !== undefined && best.score - runnerUp.score < CLOSE_SCORE,
            },
            null,
        ];
    }

    private score(
        goal: Goal,
        needs: NeedsModel,
        personality: PersonalityModel,
        intention: Intention | null,
    ): number {
        const needPressure = needs.pressure(KIND_NEEDS[goal.kind]);
        const traitFactor = this.traitFactor(goal.kind, personality);
        const commitment = intention?.goalId === goal.id ? this.commitmentBonus : 0;
        const riskPenalty = goal.estimatedRisk * (0.4 + personality.weight('caution'));
        return (
            goal.priority / 100 +
            needPressure * traitFactor +
            goal.expectedValue -
            goal.estimatedCost -
            riskPenalty +
            commitment
        );
    }

    private traitFactor(kind: GoalKind, personality: PersonalityModel): number {
        switch (kind) {
            case 'survive':
                return 0.5 + personality.weight('caution');
            case 'eat':
            case 'rest':
                return 0.5 + personality.weight('orderliness');
            case 'gather':
            case 'craft':
                return 0.5 + personality.weight('industriousness');
            case 'shelter':
            case 'return-home':
            case 'deposit':
                return 0.5 + personality.weight('orderliness');
            case 'explore':
                return 0.5 + personality.weight('curiosity');
            case 'social':
                return 0.5 + personality.weight('sociability');
            case 'leisure':
                return 0.5;
        }
    }
}

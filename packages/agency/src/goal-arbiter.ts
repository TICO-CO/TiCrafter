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
    'prepare-night': 'shelter',
    'build-shelter': 'shelter',
    'dig-shelter': 'shelter',
    'secure-bed': 'rest',
    'gather-wool': 'materials',
    'gather-food': 'hunger',
    'equip-gear': 'tools',
    'harvest-farm': 'materials',
    'plant-farm': 'materials',
};

export function goalNeedFor(kind: GoalKind): NeedName {
    return KIND_NEEDS[kind];
}

const DEFAULT_CLOSE_SCORE = 0.12;
const DEFAULT_COMMITMENT_BONUS = 0.15;

export interface GoalArbiterOptions {
    commitmentBonus?: number;
    closeScore?: number;
}

export interface GoalCandidate {
    goal: Goal;
    score: number;
}

export interface GoalSelection {
    goal: Goal;
    score: number;
    layaShouldAdvise: boolean;
    closeCandidates: readonly GoalCandidate[];
}

export class GoalArbiter {
    private readonly commitmentBonus: number;
    private readonly closeScore: number;

    private constructor(options: GoalArbiterOptions) {
        this.commitmentBonus = options.commitmentBonus ?? DEFAULT_COMMITMENT_BONUS;
        this.closeScore = options.closeScore ?? DEFAULT_CLOSE_SCORE;
    }

    static create(options: GoalArbiterOptions = {}): Result<GoalArbiter, string> {
        const commitmentBonus = options.commitmentBonus ?? DEFAULT_COMMITMENT_BONUS;
        if (!Number.isFinite(commitmentBonus) || commitmentBonus < 0 || commitmentBonus > 1) {
            return [null, 'commitmentBonus must be between 0 and 1'];
        }
        const closeScore = options.closeScore ?? DEFAULT_CLOSE_SCORE;
        if (!Number.isFinite(closeScore) || closeScore < 0 || closeScore > 1) {
            return [null, 'closeScore must be between 0 and 1'];
        }
        return [new GoalArbiter(options), null];
    }

    scoreGoal(
        goal: Goal,
        needs: NeedsModel,
        personality: PersonalityModel,
        intention: Intention | null,
    ): number {
        return this.score(goal, needs, personality, intention);
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
        const layaShouldAdvise =
            runnerUp !== undefined && best.score - runnerUp.score < this.closeScore;
        const closeCandidates = layaShouldAdvise
            ? scored.filter((candidate) => best.score - candidate.score < this.closeScore)
            : [best];
        return [
            {
                goal: best.goal,
                score: best.score,
                layaShouldAdvise,
                closeCandidates,
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
            case 'prepare-night':
            case 'build-shelter':
            case 'dig-shelter':
            case 'secure-bed':
            case 'gather-wool':
            case 'gather-food':
            case 'equip-gear':
            case 'harvest-farm':
            case 'plant-farm':
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

import type { Result } from '@ticrafter/core';

import type { PersonalityModel } from './personality-model.js';
import type { AbandonmentReason, Goal, GoalKind, Intention, PersonalityTraits } from './types.js';

const DEFAULT_MAX_TRAIT_DELTA = 0.01;
const MAXIMUM_TRAIT_DELTA = 0.1;

export type ReflectionMood =
    'calm' | 'content' | 'wary' | 'frustrated' | 'resolute' | 'restless' | 'withdrawn';

export type ReflectionOutcome = 'completed' | 'abandoned';

export interface ReflectionOptions {
    maxTraitDelta?: number;
}

export interface ReflectionInput {
    goal: Goal;
    intention: Intention;
    outcome: ReflectionOutcome;
    reason: AbandonmentReason | null;
    traits: PersonalityModel;
}

export interface ReflectionResult {
    mood: ReflectionMood;
    summary: string;
    traits: PersonalityModel;
    traitDeltas: Partial<PersonalityTraits>;
}

export class ReflectionModel {
    static reflect(
        input: ReflectionInput,
        options: ReflectionOptions = {},
    ): Result<ReflectionResult, string> {
        const maxTraitDelta = options.maxTraitDelta ?? DEFAULT_MAX_TRAIT_DELTA;
        if (
            !Number.isFinite(maxTraitDelta) ||
            maxTraitDelta < 0 ||
            maxTraitDelta > MAXIMUM_TRAIT_DELTA
        ) {
            return [null, `maxTraitDelta must be between 0 and ${MAXIMUM_TRAIT_DELTA}`];
        }
        const [mood, traitDeltas, summary] = ReflectionModel.reaction(input, maxTraitDelta);
        const [traits, traitsError] = input.traits.adjust(traitDeltas);
        if (traitsError) return [null, traitsError];
        if (traits === null) return [null, 'reflection returned null personality'];
        return [{ mood, summary, traits, traitDeltas }, null];
    }

    private static reaction(
        input: ReflectionInput,
        maximum: number,
    ): [ReflectionMood, Partial<PersonalityTraits>, string] {
        if (input.outcome === 'completed') {
            return [
                'content',
                { [ReflectionModel.traitFor(input.goal.kind)]: maximum },
                `Completed ${input.goal.label}`,
            ];
        }
        const delta = maximum * Math.min(1, (input.intention.attempts + 1) / 3);
        switch (input.reason) {
            case 'unsafe':
                return ['wary', { caution: delta }, `Abandoned ${input.goal.label}: unsafe`];
            case 'infeasible':
                return [
                    'frustrated',
                    { patience: -delta },
                    `Abandoned ${input.goal.label}: infeasible`,
                ];
            case 'preempted':
                return [
                    'resolute',
                    { patience: delta },
                    `Abandoned ${input.goal.label}: preempted`,
                ];
            case 'expired':
                return [
                    'restless',
                    { orderliness: -delta },
                    `Abandoned ${input.goal.label}: expired`,
                ];
            case 'deadline':
                return [
                    'restless',
                    { orderliness: -delta },
                    `Abandoned ${input.goal.label}: deadline`,
                ];
            case 'claim_conflict':
                return [
                    'wary',
                    { patience: delta },
                    `Abandoned ${input.goal.label}: claim conflict`,
                ];
            case 'social_rejection':
                return [
                    'withdrawn',
                    { sociability: -delta },
                    `Abandoned ${input.goal.label}: social rejection`,
                ];
            case null:
                return ['frustrated', { orderliness: -delta }, `Abandoned ${input.goal.label}`];
        }
    }

    private static traitFor(kind: GoalKind): keyof PersonalityTraits {
        switch (kind) {
            case 'survive':
                return 'caution';
            case 'eat':
            case 'rest':
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
                return 'orderliness';
            case 'gather':
            case 'craft':
                return 'industriousness';
            case 'explore':
            case 'leisure':
                return 'curiosity';
            case 'social':
                return 'sociability';
        }
    }
}

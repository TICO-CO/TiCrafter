import type { Result } from '@ticrafter/core';

import type { PersonalityTraits } from './types.js';

const TRAIT_NAMES = [
    'curiosity',
    'industriousness',
    'caution',
    'sociability',
    'ambition',
    'orderliness',
    'patience',
] as const;

type TraitName = (typeof TRAIT_NAMES)[number];

const DEFAULT_TRAITS: PersonalityTraits = {
    curiosity: 0.5,
    industriousness: 0.5,
    caution: 0.5,
    sociability: 0.5,
    ambition: 0.5,
    orderliness: 0.5,
    patience: 0.5,
};

export class PersonalityModel {
    private constructor(readonly traits: PersonalityTraits) {}

    static create(traits: Partial<PersonalityTraits> = {}): Result<PersonalityModel, string> {
        const merged: PersonalityTraits = { ...DEFAULT_TRAITS, ...traits };
        for (const name of TRAIT_NAMES) {
            if (!PersonalityModel.isRatio(merged[name])) {
                return [null, `trait ${name} must be between 0 and 1`];
            }
        }
        return [new PersonalityModel(merged), null];
    }

    static fromBotIndex(botIndex: number): PersonalityModel {
        const traits: PersonalityTraits = {
            curiosity: PersonalityModel.ratio(botIndex * 37),
            industriousness: PersonalityModel.ratio(botIndex * 37 + 1),
            caution: PersonalityModel.ratio(botIndex * 37 + 2),
            sociability: PersonalityModel.ratio(botIndex * 37 + 3),
            ambition: PersonalityModel.ratio(botIndex * 37 + 4),
            orderliness: PersonalityModel.ratio(botIndex * 37 + 5),
            patience: PersonalityModel.ratio(botIndex * 37 + 6),
        };
        return new PersonalityModel(traits);
    }

    weight(name: TraitName): number {
        return this.traits[name];
    }

    private static ratio(seed: number): number {
        const value = Math.sin(seed + 1) * 10_000;
        return Number((value - Math.floor(value)).toFixed(3));
    }

    private static isRatio(value: number): boolean {
        return Number.isFinite(value) && value >= 0 && value <= 1;
    }
}

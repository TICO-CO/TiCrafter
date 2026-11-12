import type { Result } from '@ticrafter/core';

import type { NeedLevels, NeedName } from './types.js';

const NEED_NAMES: readonly NeedName[] = [
    'safety',
    'hunger',
    'rest',
    'materials',
    'tools',
    'shelter',
    'social',
    'novelty',
    'achievement',
];

const DEFAULT_LEVELS: NeedLevels = {
    safety: 1,
    hunger: 1,
    rest: 1,
    materials: 0.5,
    tools: 0.5,
    shelter: 0.5,
    social: 0.5,
    novelty: 0.5,
    achievement: 0.5,
};

const DEFAULT_DECAY_PER_MINUTE: NeedLevels = {
    safety: 0.01,
    hunger: 0.02,
    rest: 0.01,
    materials: 0.01,
    tools: 0.005,
    shelter: 0.005,
    social: 0.015,
    novelty: 0.02,
    achievement: 0.005,
};

export class NeedsModel {
    private constructor(readonly levels: NeedLevels) {}

    static create(levels: Partial<NeedLevels> = {}): Result<NeedsModel, string> {
        const merged: NeedLevels = { ...DEFAULT_LEVELS, ...levels };
        for (const name of NEED_NAMES) {
            if (!NeedsModel.isRatio(merged[name])) {
                return [null, `need ${name} must be between 0 and 1`];
            }
        }
        return [new NeedsModel(merged), null];
    }

    static defaults(): NeedsModel {
        return new NeedsModel(DEFAULT_LEVELS);
    }

    static restore(levels: Partial<NeedLevels>): Result<NeedsModel, string> {
        for (const name of NEED_NAMES) {
            if (!(name in levels)) return [null, `need ${name} is required`];
            if (!NeedsModel.isRatio(levels[name] ?? Number.NaN)) {
                return [null, `need ${name} must be between 0 and 1`];
            }
        }
        return [new NeedsModel({ ...DEFAULT_LEVELS, ...levels }), null];
    }

    decay(elapsedMilliseconds: number, rates: Partial<NeedLevels> = {}): NeedsModel {
        const minutes = Math.max(0, elapsedMilliseconds) / 60_000;
        const combined: NeedLevels = { ...DEFAULT_DECAY_PER_MINUTE, ...rates };
        const levels = Object.fromEntries(
            NEED_NAMES.map((name) => [
                name,
                NeedsModel.clamp(this.levels[name] - combined[name] * minutes),
            ]),
        ) as unknown as NeedLevels;
        return new NeedsModel(levels);
    }

    decayUniform(elapsedMilliseconds: number, ratePerMinute: number): NeedsModel {
        const rate = NeedsModel.clamp(ratePerMinute);
        const rates = Object.fromEntries(
            NEED_NAMES.map((name) => [name, rate]),
        ) as unknown as Partial<NeedLevels>;
        return this.decay(elapsedMilliseconds, rates);
    }

    satisfy(name: NeedName, amount: number): NeedsModel {
        const levels = Object.fromEntries(
            NEED_NAMES.map((need) => [
                need,
                need === name ? NeedsModel.clamp(this.levels[need] + amount) : this.levels[need],
            ]),
        ) as unknown as NeedLevels;
        return new NeedsModel(levels);
    }

    urgent(threshold = 0.65): readonly NeedName[] {
        return NEED_NAMES.filter((name) => this.levels[name] < threshold);
    }

    pressure(name: NeedName): number {
        return 1 - this.levels[name];
    }

    lowest(): NeedName {
        return NEED_NAMES.reduce((current, candidate) =>
            this.levels[candidate] < this.levels[current] ? candidate : current,
        );
    }

    private static isRatio(value: number): boolean {
        return Number.isFinite(value) && value >= 0 && value <= 1;
    }

    private static clamp(value: number): number {
        return Math.min(1, Math.max(0, value));
    }
}

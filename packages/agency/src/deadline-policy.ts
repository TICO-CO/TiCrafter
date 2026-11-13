import type { GoalKind } from './types.js';

const DEFAULT_DURATION_MILLISECONDS = 180_000;

const DURATIONS: Readonly<Record<GoalKind, number>> = {
    survive: 30_000,
    eat: 120_000,
    rest: 900_000,
    gather: 300_000,
    craft: 180_000,
    shelter: 180_000,
    explore: 180_000,
    social: 60_000,
    'return-home': 120_000,
    deposit: 120_000,
    leisure: 60_000,
    'prepare-night': 300_000,
    'build-shelter': 600_000,
    'dig-shelter': 300_000,
    'secure-bed': 300_000,
    'gather-wool': 300_000,
    'gather-food': 180_000,
    'equip-gear': 120_000,
    'harvest-farm': 300_000,
    'plant-farm': 180_000,
};

export type GoalDeadlineOverrides = Partial<Record<GoalKind, number>>;

export class GoalDeadlinePolicy {
    static durationFor(kind: GoalKind, overrides: GoalDeadlineOverrides = {}): number {
        const override = overrides[kind];
        if (override !== undefined && Number.isFinite(override) && override > 0) return override;
        return DURATIONS[kind] ?? DEFAULT_DURATION_MILLISECONDS;
    }

    static deadlineFor(
        kind: GoalKind,
        now: string,
        overrides: GoalDeadlineOverrides = {},
    ): string | null {
        const nowMilliseconds = Date.parse(now);
        if (!Number.isFinite(nowMilliseconds)) return null;
        return new Date(
            nowMilliseconds + GoalDeadlinePolicy.durationFor(kind, overrides),
        ).toISOString();
    }

    static extend(
        deadline: string,
        kind: GoalKind,
        overrides: GoalDeadlineOverrides = {},
    ): string | null {
        const deadlineMilliseconds = Date.parse(deadline);
        if (!Number.isFinite(deadlineMilliseconds)) return null;
        return new Date(
            deadlineMilliseconds + GoalDeadlinePolicy.durationFor(kind, overrides),
        ).toISOString();
    }

    static expired(deadline: string | null, now: string): boolean {
        if (deadline === null) return false;
        const deadlineMilliseconds = Date.parse(deadline);
        const nowMilliseconds = Date.parse(now);
        if (!Number.isFinite(deadlineMilliseconds) || !Number.isFinite(nowMilliseconds)) {
            return false;
        }
        return deadlineMilliseconds <= nowMilliseconds;
    }
}

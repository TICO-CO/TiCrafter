export type DayPhase = 'morning' | 'day' | 'evening' | 'night';

const TICKS_PER_DAY = 24_000;
const MORNING_END = 6_000;
const DAY_END = 10_500;
const NIGHT_START = 13_000;

export class DayCycle {
    static phase(timeOfDay: number | null | undefined): DayPhase {
        if (timeOfDay === null || timeOfDay === undefined) return 'day';
        const normalized = DayCycle.normalize(timeOfDay);
        if (normalized < MORNING_END) return 'morning';
        if (normalized < DAY_END) return 'day';
        if (normalized < NIGHT_START) return 'evening';
        return 'night';
    }

    static isDusk(phase: DayPhase): boolean {
        return phase === 'evening';
    }

    static isNight(phase: DayPhase): boolean {
        return phase === 'night';
    }

    static isPreparationWindow(phase: DayPhase): boolean {
        return phase === 'evening';
    }

    static isNightTime(timeOfDay: number | null | undefined): boolean {
        return DayCycle.phase(timeOfDay) === 'night';
    }

    static isDaytime(timeOfDay: number | null | undefined): boolean {
        if (timeOfDay === null || timeOfDay === undefined) return false;
        return !DayCycle.isNightTime(timeOfDay);
    }

    static ticksUntilNight(timeOfDay: number | null): number {
        if (timeOfDay === null) return 0;
        const normalized = DayCycle.normalize(timeOfDay);
        if (normalized >= NIGHT_START) return 0;
        return NIGHT_START - normalized;
    }

    private static normalize(timeOfDay: number): number {
        return ((timeOfDay % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
    }
}

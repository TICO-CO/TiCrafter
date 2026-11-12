import type { RoutinePhase, RoutineState } from './types.js';

const TICKS_PER_DAY = 24_000;
const NIGHT_END = 6_000;
const MORNING_END = 9_000;
const DAY_END = 16_500;
const NIGHT_START = 19_500;

export class RoutineModel {
    static phase(timeOfDay: number | null): RoutinePhase {
        if (timeOfDay === null) return 'day';
        const normalized = RoutineModel.normalize(timeOfDay);
        if (normalized < NIGHT_END) return 'night';
        if (normalized < MORNING_END) return 'morning';
        if (normalized < DAY_END) return 'day';
        if (normalized < NIGHT_START) return 'evening';
        return 'night';
    }

    static isDusk(phase: RoutinePhase): boolean {
        return phase === 'evening';
    }

    static isNight(phase: RoutinePhase): boolean {
        return phase === 'night';
    }

    static isPreparationWindow(phase: RoutinePhase): boolean {
        return phase === 'evening';
    }

    static isNightTime(timeOfDay: number | null): boolean {
        return RoutineModel.phase(timeOfDay) === 'night';
    }

    static ticksUntilNight(timeOfDay: number | null): number {
        if (timeOfDay === null) return 0;
        const normalized = RoutineModel.normalize(timeOfDay);
        if (normalized < NIGHT_END) return 0;
        if (normalized >= NIGHT_START) return 0;
        return NIGHT_START - normalized;
    }

    static initialState(timeOfDay: number | null): RoutineState {
        return {
            phase: RoutineModel.phase(timeOfDay),
            lastMealAt: null,
            lastRestAt: null,
        };
    }

    static update(
        state: RoutineState,
        timeOfDay: number | null,
        event: 'meal' | 'rest' | null,
        now: string,
    ): RoutineState {
        return {
            phase: RoutineModel.phase(timeOfDay),
            lastMealAt: event === 'meal' ? now : state.lastMealAt,
            lastRestAt: event === 'rest' ? now : state.lastRestAt,
        };
    }

    static prefersRest(phase: RoutinePhase): boolean {
        return phase === 'night';
    }

    static prefersWork(phase: RoutinePhase): boolean {
        return phase === 'morning' || phase === 'day';
    }

    private static normalize(timeOfDay: number): number {
        return ((timeOfDay % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
    }
}

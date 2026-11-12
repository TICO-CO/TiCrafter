import type { RoutinePhase, RoutineState } from './types.js';

export class RoutineModel {
    static phase(timeOfDay: number | null): RoutinePhase {
        if (timeOfDay === null) return 'day';
        const normalized = ((timeOfDay % 24_000) + 24_000) % 24_000;
        if (normalized < 6_000) return 'night';
        if (normalized < 9_000) return 'morning';
        if (normalized < 16_500) return 'day';
        if (normalized < 19_500) return 'evening';
        return 'night';
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
}

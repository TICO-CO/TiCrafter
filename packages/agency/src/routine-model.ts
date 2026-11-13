import { DayCycle } from '@ticrafter/core';

import type { RoutinePhase, RoutineState } from './types.js';

export class RoutineModel {
    static phase(timeOfDay: number | null): RoutinePhase {
        return DayCycle.phase(timeOfDay);
    }

    static isDusk(phase: RoutinePhase): boolean {
        return DayCycle.isDusk(phase);
    }

    static isNight(phase: RoutinePhase): boolean {
        return DayCycle.isNight(phase);
    }

    static isPreparationWindow(phase: RoutinePhase): boolean {
        return DayCycle.isPreparationWindow(phase);
    }

    static isNightTime(timeOfDay: number | null): boolean {
        return DayCycle.isNightTime(timeOfDay);
    }

    static ticksUntilNight(timeOfDay: number | null): number {
        return DayCycle.ticksUntilNight(timeOfDay);
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

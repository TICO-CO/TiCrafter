import type { Result } from '@ticrafter/core';

import { NeedsModel } from './needs-model.js';
import { PersonalityModel } from './personality-model.js';
import { RoutineModel } from './routine-model.js';
import type { Intention, NeedName, RoutineState, WorkingMemory } from './types.js';
import { WorkingMemoryModel } from './working-memory.js';

export interface AgencyStateSnapshot {
    botId: string;
    traits: PersonalityModel;
    needs: NeedsModel;
    intention: Intention | null;
    routine: RoutineState;
    homeStructureId: string | null;
    personalStorageId: string | null;
    mood: string;
    lastDeliberationAt: string | null;
    workingMemory: WorkingMemory;
}

export class AgencyState {
    private constructor(readonly snapshot: AgencyStateSnapshot) {}

    static create(input: {
        botId: string;
        traits?: PersonalityModel;
        needs?: NeedsModel;
        intention?: Intention | null;
        routine?: RoutineState;
        timeOfDay?: number | null;
    }): Result<AgencyState, string> {
        if (input.botId.length === 0) return [null, 'botId is required'];
        const [traits, traitsError] = input.traits
            ? [input.traits, null]
            : PersonalityModel.create();
        if (traitsError) return [null, traitsError];
        if (traits === null) return [null, 'personality returned null'];
        const [needs, needsError] = input.needs ? [input.needs, null] : NeedsModel.create();
        if (needsError) return [null, needsError];
        if (needs === null) return [null, 'needs returned null'];
        return [
            new AgencyState({
                botId: input.botId,
                traits,
                needs,
                intention: input.intention ?? null,
                routine: input.routine ?? RoutineModel.initialState(input.timeOfDay ?? null),
                homeStructureId: null,
                personalStorageId: null,
                mood: 'calm',
                lastDeliberationAt: null,
                workingMemory: WorkingMemoryModel.create().snapshot,
            }),
            null,
        ];
    }

    static restore(input: AgencyStateSnapshot): Result<AgencyState, string> {
        if (input.botId.length === 0) return [null, 'botId is required'];
        if (input.mood.length === 0) return [null, 'mood is required'];
        const intentionError = AgencyState.validateIntention(input.intention);
        if (intentionError !== null) return [null, intentionError];
        const [workingMemory, memoryError] = WorkingMemoryModel.restore(input.workingMemory);
        if (memoryError) return [null, memoryError];
        if (workingMemory === null) return [null, 'working memory returned null'];
        return [new AgencyState({ ...input, workingMemory: workingMemory.snapshot }), null];
    }

    decayNeeds(elapsedMilliseconds: number, ratePerMinute: number): AgencyState {
        return new AgencyState({
            ...this.snapshot,
            needs: this.snapshot.needs.decayUniform(elapsedMilliseconds, ratePerMinute),
        });
    }

    satisfyNeed(name: NeedName, amount: number): AgencyState {
        return new AgencyState({
            ...this.snapshot,
            needs: this.snapshot.needs.satisfy(name, amount),
        });
    }

    withIntention(intention: Intention | null): AgencyState {
        return new AgencyState({ ...this.snapshot, intention });
    }

    withRoutine(routine: RoutineState): AgencyState {
        return new AgencyState({ ...this.snapshot, routine });
    }

    withHome(homeStructureId: string | null, personalStorageId: string | null): AgencyState {
        return new AgencyState({ ...this.snapshot, homeStructureId, personalStorageId });
    }

    withMood(mood: string): AgencyState {
        return new AgencyState({ ...this.snapshot, mood });
    }

    withWorkingMemory(workingMemory: WorkingMemory): AgencyState {
        return new AgencyState({ ...this.snapshot, workingMemory });
    }

    touchDeliberation(now: string): AgencyState {
        return new AgencyState({ ...this.snapshot, lastDeliberationAt: now });
    }

    private static validateIntention(intention: Intention | null): string | null {
        if (intention === null) return null;
        if (intention.goalId.length === 0) return 'intention goalId is required';
        if (intention.label.length === 0) return 'intention label is required';
        if (!Number.isInteger(intention.stepIndex) || intention.stepIndex < 0) {
            return 'intention stepIndex must be a non-negative integer';
        }
        if (!Number.isInteger(intention.attempts) || intention.attempts < 0) {
            return 'intention attempts must be a non-negative integer';
        }
        if (intention.createdAt.length === 0) return 'intention createdAt is required';
        return null;
    }
}

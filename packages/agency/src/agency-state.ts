import type { Result } from '@ticrafter/core';

import { NeedsModel } from './needs-model.js';
import { PersonalityModel } from './personality-model.js';
import { RoutineModel } from './routine-model.js';
import type { Intention, RoutineState } from './types.js';

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
            }),
            null,
        ];
    }
}

import {
    type AgencySnapshot,
    GoalArbiter,
    type GoalGenerator,
    type Intention,
    IntentionManager,
    type NeedsModel,
    type PersonalityModel,
    RoutineModel,
    type RoutineState,
} from '@ticrafter/agency';
import type { Result } from '@ticrafter/core';

export interface AgentLoopSnapshotPort {
    read(): Result<
        {
            snapshot: AgencySnapshot;
            needs: NeedsModel;
            traits: PersonalityModel;
            routine: RoutineState;
        },
        string
    >;
}

export interface AgentLoopOptions {
    botId: string;
    generator: GoalGenerator;
    arbiter: GoalArbiter;
    intentions: IntentionManager;
    snapshots: AgentLoopSnapshotPort;
}

export interface AgentLoopTick {
    intention: Intention | null;
    goalId: string | null;
    consultLaya: boolean;
    phase: RoutineState['phase'];
}

export class AgentLoop {
    constructor(private readonly options: AgentLoopOptions) {}

    tick(now: string): Result<AgentLoopTick, string> {
        const active = this.options.intentions.intention;
        if (active !== null) {
            const [state, stateError] = this.options.snapshots.read();
            if (stateError) return [null, stateError];
            if (state === null) return [null, 'snapshot returned null'];
            return [
                {
                    intention: active,
                    goalId: active.goalId,
                    consultLaya: false,
                    phase: state.routine.phase,
                },
                null,
            ];
        }
        const [state, stateError] = this.options.snapshots.read();
        if (stateError) return [null, stateError];
        if (state === null) return [null, 'snapshot returned null'];
        const phase = RoutineModel.phase(state.snapshot.timeOfDay);
        const [goals, goalError] = this.options.generator.generate(
            state.snapshot,
            state.needs,
            state.traits,
            phase,
        );
        if (goalError) return [null, goalError];
        if (goals === null) return [null, 'goal generation returned null'];
        const [selection, selectionError] = this.options.arbiter.select(
            goals,
            state.needs,
            state.traits,
            null,
        );
        if (selectionError) return [null, selectionError];
        if (selection === null) return [null, 'goal arbitration returned null'];
        const [intention, intentionError] = this.options.intentions.begin(selection.goal, now);
        if (intentionError) return [null, intentionError];
        if (intention === null) return [null, 'intention creation returned null'];
        return [
            {
                intention,
                goalId: selection.goal.id,
                consultLaya: selection.layaShouldAdvise,
                phase,
            },
            null,
        ];
    }
}

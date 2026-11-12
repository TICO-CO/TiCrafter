import {
    type AbandonmentReason,
    type AgencySnapshot,
    type Goal,
    GoalArbiter,
    type GoalGenerator,
    type Intention,
    IntentionManager,
    type NeedsModel,
    type NightPrepConfig,
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
    nightPrep?: NightPrepConfig;
}

export interface AgentLoopTick {
    intention: Intention;
    goal: Goal;
    goalId: string;
    consultLaya: boolean;
    phase: RoutineState['phase'];
}

export class AgentLoop {
    private activeGoal: Goal | null = null;

    constructor(private readonly options: AgentLoopOptions) {}

    get intention(): Intention | null {
        return this.options.intentions.intention;
    }

    get goal(): Goal | null {
        return this.activeGoal;
    }

    tick(now: string): Result<AgentLoopTick, string> {
        const active = this.options.intentions.intention;
        if (active !== null) {
            if (this.activeGoal === null) return [null, 'active intention has no goal'];
            const [state, stateError] = this.options.snapshots.read();
            if (stateError) return [null, stateError];
            if (state === null) return [null, 'snapshot returned null'];
            return [
                {
                    intention: active,
                    goal: this.activeGoal,
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
            this.options.nightPrep,
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
        this.activeGoal = selection.goal;
        return [
            {
                intention,
                goal: selection.goal,
                goalId: selection.goal.id,
                consultLaya: selection.layaShouldAdvise,
                phase,
            },
            null,
        ];
    }

    restore(goal: Goal, intention: Intention): Result<Intention, string> {
        if (goal.id !== intention.goalId) return [null, 'goal does not match intention'];
        this.options.intentions.restore(intention);
        this.activeGoal = goal;
        return [intention, null];
    }

    advance(now: string): Result<Intention, string> {
        const [intention, intentionError] = this.options.intentions.advance(now);
        if (intentionError) return [null, intentionError];
        if (intention === null) return [null, 'intention advance returned null'];
        return [intention, null];
    }

    retry(): Result<Intention, string> {
        const [intention, intentionError] = this.options.intentions.retry();
        if (intentionError) return [null, intentionError];
        if (intention === null) return [null, 'intention retry returned null'];
        return [intention, null];
    }

    complete(now: string): Result<Intention, string> {
        const [outcome, outcomeError] = this.options.intentions.complete(now);
        if (outcomeError) return [null, outcomeError];
        if (outcome === null) return [null, 'intention completion returned null'];
        this.activeGoal = null;
        return [outcome.intention, null];
    }

    abandon(reason: AbandonmentReason, now: string): Result<Intention, string> {
        const [outcome, outcomeError] = this.options.intentions.abandon(reason, now);
        if (outcomeError) return [null, outcomeError];
        if (outcome === null) return [null, 'intention abandonment returned null'];
        this.activeGoal = null;
        return [outcome.intention, null];
    }

    expired(now: string): boolean {
        return this.options.intentions.expired(now);
    }
}

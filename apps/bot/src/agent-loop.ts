import {
    type AbandonmentReason,
    type AgencySnapshot,
    type Goal,
    GoalArbiter,
    type GoalGenerator,
    type GoalSelection,
    type Intention,
    IntentionManager,
    type NeedsModel,
    type NightPrepConfig,
    type PersonalityModel,
    ProjectFocusPolicy,
    RoutineModel,
    type RoutineState,
    StrategicIntentPolicy,
    type WorkingMemoryFocus,
} from '@ticrafter/agency';
import type { Result, StrategicIntent } from '@ticrafter/core';

import type { GoalTieBreakContext, GoalTieBreakPort } from './goal-tie-break.js';

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
    focus?: () => WorkingMemoryFocus | null;
    strategicIntent?: () => StrategicIntent | null;
    nightPrep?: NightPrepConfig;
    tieBreak?: GoalTieBreakPort;
    tieBreakEnabled?: boolean;
    tacticalContext?: () => GoalTieBreakContext;
    recordTacticalDecision?: (input: {
        choiceId: string;
        source: 'laya' | 'fallback' | 'deterministic';
        revision: number;
        at: string;
    }) => void;
    recordTacticalDrop?: (input: {
        choiceId: string;
        revision: number;
        reason: string;
        at: string;
    }) => void;
    deadlineFor?: (goal: Goal, now: string) => string | null;
    progressionGoal?: (snapshot: AgencySnapshot, now: string) => Result<Goal | null, string>;
    minimumDwellMilliseconds?: number;
    switchThreshold?: number;
}

const DEFAULT_MINIMUM_DWELL_MILLISECONDS = 30_000;
const DEFAULT_SWITCH_THRESHOLD = 0.2;
const URGENT_GOAL_KINDS = new Set<Goal['kind']>(['survive', 'eat']);

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

    async reconsider(now: string): Promise<Result<AgentLoopTick | null, string>> {
        const activeIntention = this.options.intentions.intention;
        const activeGoal = this.activeGoal;
        if (activeIntention === null || activeGoal === null) return [null, null];
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
        const focus = this.options.focus?.() ?? null;
        const filtered =
            focus?.kind === 'project'
                ? goals.filter((goal) => ProjectFocusPolicy.allowsGoal(goal.kind))
                : goals;
        const candidates = StrategicIntentPolicy.applyToGoals(
            filtered,
            this.options.strategicIntent?.() ?? null,
            this.options.botId,
        );
        const withActive = candidates.some((candidate) => candidate.id === activeGoal.id)
            ? candidates
            : [activeGoal, ...candidates];
        if (withActive.length === 0) return [null, null];
        const [selection, selectionError] = this.options.arbiter.select(
            withActive,
            state.needs,
            state.traits,
            activeIntention,
        );
        if (selectionError) return [null, selectionError];
        if (selection === null) return [null, 'goal arbitration returned null'];
        if (selection.goal.id === activeGoal.id) return [null, null];
        const urgent = URGENT_GOAL_KINDS.has(selection.goal.kind);
        if (!urgent && !this.dwellElapsed(activeIntention.createdAt, now)) return [null, null];
        const currentScore = this.options.arbiter.scoreGoal(
            activeGoal,
            state.needs,
            state.traits,
            activeIntention,
        );
        if (selection.score - currentScore < this.switchThreshold()) return [null, null];
        const [, abandonError] = this.options.intentions.abandon('preempted', now);
        if (abandonError) return [null, abandonError];
        const scheduledGoal = this.withDeadline(selection.goal, now);
        const [intention, intentionError] = this.options.intentions.begin(scheduledGoal, now);
        if (intentionError) return [null, intentionError];
        if (intention === null) return [null, 'intention creation returned null'];
        this.activeGoal = scheduledGoal;
        return [
            {
                intention,
                goal: scheduledGoal,
                goalId: scheduledGoal.id,
                consultLaya: false,
                phase,
            },
            null,
        ];
    }

    async tick(now: string): Promise<Result<AgentLoopTick | null, string>> {
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
        const focus = this.options.focus?.() ?? null;
        const filtered =
            focus?.kind === 'project'
                ? goals.filter((goal) => ProjectFocusPolicy.allowsGoal(goal.kind))
                : goals;
        const [progressionGoal, progressionError] = this.options.progressionGoal?.(
            state.snapshot,
            now,
        ) ?? [null, null];
        if (progressionError) return [null, progressionError];
        const withProgression =
            progressionGoal === null ? filtered : [progressionGoal, ...filtered];
        const candidates = StrategicIntentPolicy.applyToGoals(
            withProgression,
            this.options.strategicIntent?.() ?? null,
            this.options.botId,
        );
        if (candidates.length === 0) return [null, null];
        const [selection, selectionError] = this.options.arbiter.select(
            candidates,
            state.needs,
            state.traits,
            null,
        );
        if (selectionError) return [null, selectionError];
        if (selection === null) return [null, 'goal arbitration returned null'];
        const [selectedGoal, consultedLaya] = await this.tieBreak(state, selection, now);
        const scheduledGoal = this.withDeadline(selectedGoal, now);
        const [intention, intentionError] = this.options.intentions.begin(scheduledGoal, now);
        if (intentionError) return [null, intentionError];
        if (intention === null) return [null, 'intention creation returned null'];
        this.activeGoal = scheduledGoal;
        return [
            {
                intention,
                goal: scheduledGoal,
                goalId: scheduledGoal.id,
                consultLaya: consultedLaya,
                phase,
            },
            null,
        ];
    }

    private async tieBreak(
        state: {
            snapshot: AgencySnapshot;
            needs: NeedsModel;
            traits: PersonalityModel;
            routine: RoutineState;
        },
        selection: GoalSelection,
        now: string,
    ): Promise<[Goal, boolean]> {
        if (
            this.options.tieBreakEnabled !== true ||
            !selection.layaShouldAdvise ||
            selection.closeCandidates.length < 2 ||
            this.options.tieBreak === undefined ||
            this.options.tacticalContext === undefined
        ) {
            return [selection.goal, false];
        }
        const before = this.options.tacticalContext();
        const [outcome, outcomeError] = await this.options.tieBreak.decide({
            botId: this.options.botId,
            at: now,
            snapshot: state.snapshot,
            selected: selection.goal,
            candidates: selection.closeCandidates,
            tactical: before,
        });
        if (outcomeError || outcome === null) {
            this.options.recordTacticalDecision?.({
                choiceId: `goal:${selection.goal.id}`,
                source: 'deterministic',
                revision: before.revision,
                at: now,
            });
            return [selection.goal, true];
        }
        const after = this.options.tacticalContext();
        if (
            after.revision !== before.revision ||
            AgentLoop.focusKey(after.focus) !== AgentLoop.focusKey(before.focus)
        ) {
            this.options.recordTacticalDrop?.({
                choiceId: outcome.choiceId,
                revision: before.revision,
                reason: 'working memory focus or revision changed',
                at: now,
            });
            this.options.recordTacticalDecision?.({
                choiceId: `goal:${selection.goal.id}`,
                source: 'fallback',
                revision: before.revision,
                at: now,
            });
            return [selection.goal, true];
        }
        this.options.recordTacticalDecision?.({
            choiceId: outcome.choiceId,
            source: outcome.source,
            revision: before.revision,
            at: now,
        });
        return [outcome.goal, true];
    }

    private dwellElapsed(createdAt: string, now: string): boolean {
        const created = Date.parse(createdAt);
        const current = Date.parse(now);
        if (!Number.isFinite(created) || !Number.isFinite(current)) return true;
        const minimum = this.options.minimumDwellMilliseconds ?? DEFAULT_MINIMUM_DWELL_MILLISECONDS;
        return current - created >= minimum;
    }

    private switchThreshold(): number {
        return this.options.switchThreshold ?? DEFAULT_SWITCH_THRESHOLD;
    }

    private withDeadline(goal: Goal, now: string): Goal {
        if (this.options.deadlineFor === undefined) return goal;
        const deadline = this.options.deadlineFor(goal, now);
        return { ...goal, deadline };
    }

    private static focusKey(focus: WorkingMemoryFocus | null): string | null {
        if (focus === null) return null;
        return `${focus.kind}:${focus.id}`;
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

    extendDeadline(deadline: string): Result<Intention, string> {
        const [intention, intentionError] = this.options.intentions.extendDeadline(deadline);
        if (intentionError) return [null, intentionError];
        if (intention === null) return [null, 'intention deadline extension returned null'];
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

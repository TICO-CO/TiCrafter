import {
    type AbandonmentReason,
    type AgencySnapshot,
    AgencyState,
    type Goal,
    GoalArbiter,
    type GoalDeadlineOverrides,
    GoalDeadlinePolicy,
    GoalGenerator,
    goalNeedFor,
    type Intention,
    IntentionManager,
    type JobMarketContext,
    type NeedLevels,
    type NightPrepConfig,
    NightPrepDefaults,
    NightReadinessModel,
    type ProgressionPlan,
    ProgressionPlanModel,
    type ProgressionPlannerPort,
    type ProjectSummary,
    ReflectionModel,
    type ReflectionResult,
    RoutineModel,
    StrategicIntentPolicy,
    type WorkingMemory,
    type WorkingMemoryFocus,
    WorkingMemoryModel,
} from '@ticrafter/agency';
import {
    attemptAsync,
    type ClockHandle,
    type ClockPort,
    type LoggerPort,
    type Result,
    skillInputSchema,
    type StrategicConstraint,
    type StrategicGoalKind,
    type StrategicIntent,
    SystemClock,
} from '@ticrafter/core';
import type { SkillInput, SkillProgressEvent, SkillStep } from '@ticrafter/skills';

import type { AgencyEpisodeInput } from './agency-state-adapter.js';
import { AgentLoop, type AgentLoopTick } from './agent-loop.js';
import type { BehaviorTracePort } from './behavior-trace.js';
import type { GoalTieBreakPort } from './goal-tie-break.js';

const DEFAULT_MAXIMUM_ATTEMPTS = 2;
const DEFAULT_TELEMETRY_MILLISECONDS = 5000;
const DEFAULT_PROGRESS_TIMEOUT_MILLISECONDS = 120_000;
const NEED_SATISFACTION = 0.6;
const MAXIMUM_RESTORE_DISTANCE = 128;

export interface AgencySkillPort {
    readonly activeSkillId: string | null;
    run(skillId: string, input: SkillInput): Result<SkillStep, string>;
    resume(skillId: string, taskId: string): Result<SkillStep, string>;
    preempt(reason: string): Result<SkillStep | null, string>;
}

export interface AgencyPersistencePort {
    save(state: AgencyState['snapshot'], at?: string): void;
    episode(input: AgencyEpisodeInput): void;
}

export interface AgencyRuntimeConfig {
    enabled: boolean;
    goalCadenceMilliseconds: number;
    needDecayPerMinute: number;
    committedGoalBonus: number;
    workingMemory?: {
        maxCommitments: number;
        maxExperiences: number;
    };
    goalTieBreak?: {
        enabled: boolean;
        closeScore: number;
    };
    goalDeadlines?: GoalDeadlineOverrides;
    progression?: { enabled: boolean };
    minimumDwellMilliseconds?: number;
    switchThreshold?: number;
    progressTimeoutMilliseconds?: number;
    needDecayByNeed?: Partial<NeedLevels>;
    reflection?: {
        enabled: boolean;
        maxTraitDelta: number;
    };
    nightPrep?: NightPrepConfig;
}

export interface AgencyRuntimeOptions {
    botId: string;
    context: { read(): Result<AgencySnapshot, string> };
    skills: AgencySkillPort;
    persistence: AgencyPersistencePort;
    logger: LoggerPort;
    config: AgencyRuntimeConfig;
    isPaused?: () => boolean;
    isJobActive?: () => boolean;
    isProjectTaskActive?: () => boolean;
    goalTieBreak?: GoalTieBreakPort;
    progressionPlanner?: ProgressionPlannerPort;
    trace?: BehaviorTracePort;
    now?: () => number;
    clock?: ClockPort;
    maximumAttempts?: number;
    telemetryMilliseconds?: number;
}

export interface AgencyTickReport {
    action:
        | 'disabled'
        | 'paused'
        | 'job'
        | 'project'
        | 'busy'
        | 'running'
        | 'completed'
        | 'abandoned'
        | 'retry';
    goalId: string | null;
}

export class AgencyRuntime {
    private readonly agent: AgentLoop;
    private readonly generator = new GoalGenerator();
    private readonly clock: ClockPort;
    private readonly now: () => number;
    private readonly maximumAttempts: number;
    private readonly telemetryMilliseconds: number;
    private readonly progressTimeoutMilliseconds: number;
    private state: AgencyState;
    private timer: ClockHandle | null = null;
    private lastTickAt: number;
    private lastPersistAt = 0;
    private lastProgressAt: number;
    private progressSinceDeadline = 0;
    private watchdogPreempting = false;
    private lastNightReadinessKey: string | null = null;
    private launching = false;
    private ticking = false;
    private project: ProjectSummary | null = null;

    private constructor(
        private readonly options: AgencyRuntimeOptions,
        state: AgencyState,
        arbiter: GoalArbiter,
    ) {
        this.state = state;
        this.clock = options.clock ?? new SystemClock();
        this.now = options.now ?? (() => this.clock.now());
        this.maximumAttempts = options.maximumAttempts ?? DEFAULT_MAXIMUM_ATTEMPTS;
        this.telemetryMilliseconds =
            options.telemetryMilliseconds ?? DEFAULT_TELEMETRY_MILLISECONDS;
        this.progressTimeoutMilliseconds =
            options.config.progressTimeoutMilliseconds ?? DEFAULT_PROGRESS_TIMEOUT_MILLISECONDS;
        this.lastTickAt = this.now();
        this.lastProgressAt = this.lastTickAt;
        this.agent = new AgentLoop({
            botId: options.botId,
            generator: this.generator,
            arbiter,
            intentions: new IntentionManager(),
            snapshots: { read: () => this.readSnapshot() },
            focus: () => this.focus,
            strategicIntent: () => this.strategicIntent,
            nightPrep: options.config.nightPrep,
            tieBreak: options.goalTieBreak,
            tieBreakEnabled: options.config.goalTieBreak?.enabled === true,
            tacticalContext: () => this.tacticalContext(),
            recordTacticalDecision: (input) => this.recordTacticalDecision(input),
            recordTacticalDrop: (input) => this.recordTacticalDrop(input),
            deadlineFor: (goal, now) =>
                GoalDeadlinePolicy.deadlineFor(goal.kind, now, options.config.goalDeadlines),
            progressionGoal: (snapshot, now) => this.progressionGoal(snapshot, now),
            minimumDwellMilliseconds: options.config.minimumDwellMilliseconds,
            switchThreshold: options.config.switchThreshold,
        });
    }

    static create(
        options: AgencyRuntimeOptions,
        state: AgencyState,
    ): Result<AgencyRuntime, string> {
        const [arbiter, arbiterError] = GoalArbiter.create({
            commitmentBonus: options.config.committedGoalBonus,
            closeScore: options.config.goalTieBreak?.closeScore,
        });
        if (arbiterError) return [null, arbiterError];
        if (arbiter === null) return [null, 'goal arbiter returned null'];
        return [new AgencyRuntime(options, state, arbiter), null];
    }

    get hasActiveGoal(): boolean {
        return this.agent.intention !== null;
    }

    get isIdle(): boolean {
        return this.agent.intention === null && this.options.skills.activeSkillId === null;
    }

    get needs(): AgencyState['snapshot']['needs'] {
        return this.state.snapshot.needs;
    }

    get traits(): AgencyState['snapshot']['traits'] {
        return this.state.snapshot.traits;
    }

    get workingMemory(): WorkingMemory {
        return this.state.snapshot.workingMemory;
    }

    get focus(): WorkingMemoryFocus | null {
        return this.state.snapshot.workingMemory.focus;
    }

    get strategicIntent(): StrategicIntent | null {
        return this.state.snapshot.workingMemory.strategicIntent ?? null;
    }

    setStrategicIntent(strategicIntent: StrategicIntent | null): void {
        const memory = this.memory();
        const next = memory.withStrategicIntent(strategicIntent);
        if (next === memory) return;
        this.commitMemory(next);
    }

    recordTacticalDecision(input: {
        choiceId: string;
        source: 'laya' | 'fallback' | 'deterministic';
        revision: number;
        at: string;
    }): void {
        this.commitMemory(
            this.memory().withTacticalDecision({
                choiceId: input.choiceId,
                source: input.source,
                revision: input.revision,
                at: input.at,
            }),
        );
    }

    recordTacticalDrop(input: {
        choiceId: string;
        revision: number;
        reason: string;
        at: string;
    }): void {
        this.commitMemory(
            this.memory().withExperience({
                event: `tactical.decision.dropped:${input.choiceId}`,
                outcome: `${input.reason} at revision ${input.revision}`,
                at: input.at,
            }),
        );
    }

    tacticalContext(): {
        revision: number;
        focus: WorkingMemoryFocus | null;
        commitments: WorkingMemory['commitments'];
        recentExperiences: WorkingMemory['recentExperiences'];
        interruption: WorkingMemory['interruption'];
        strategicGoal: { kind: StrategicGoalKind; weight: number } | null;
        strategicConstraints: readonly StrategicConstraint[];
    } {
        const memory = this.memory();
        const primary = StrategicIntentPolicy.primaryForBot(
            memory.strategicIntent,
            this.options.botId,
        );
        return {
            revision: memory.revision,
            focus: memory.focus,
            commitments: memory.commitments,
            recentExperiences: memory.recentExperiences,
            interruption: memory.interruption,
            strategicGoal: primary === null ? null : { kind: primary.kind, weight: primary.weight },
            strategicConstraints: StrategicIntentPolicy.constraintsFor(
                memory.strategicIntent,
                this.options.botId,
            ),
        };
    }

    get projectFocus(): ProjectSummary | null {
        return this.project;
    }

    syncProjectFocus(projects: readonly ProjectSummary[], at = this.iso(this.now())): void {
        const active =
            projects.find(
                (project) =>
                    project.status === 'active' &&
                    (project.kind === 'home' ||
                        project.kind === 'storage' ||
                        project.kind === 'build'),
            ) ??
            projects.find(
                (project) => project.status === 'proposed' || project.status === 'active',
            ) ??
            null;
        this.setProjectFocus(active, at);
    }

    setProjectFocus(project: ProjectSummary | null, at = this.iso(this.now())): void {
        this.project = project;
        const memory = this.memory();
        if (project === null) {
            if (memory.focus?.kind === 'project') {
                this.commitMemory(memory.withoutFocus());
            }
            return;
        }
        if (memory.focus?.kind === 'project' && memory.focus.id === project.id) return;
        if (this.hasActiveGoal) {
            this.commitMemory(
                memory.withInterruption({
                    reason: 'project-focus',
                    resumeCondition: 'agency goal completes',
                    interruptedFocusId: project.id,
                    at,
                }),
            );
            return;
        }
        this.commitMemory(
            memory.withFocus({
                kind: 'project',
                id: project.id,
                label: project.title,
                startedAt: at,
            }),
        );
    }

    interrupt(reason: string, resumeCondition: string, at = this.iso(this.now())): void {
        const focus = this.focus;
        if (focus === null) return;
        this.commitMemory(
            this.memory().withInterruption({
                reason,
                resumeCondition,
                interruptedFocusId: focus.id,
                at,
            }),
        );
    }

    resumeFocus(): void {
        this.commitMemory(this.memory().withoutInterruption());
    }

    jobContext(): JobMarketContext {
        return {
            role: null,
            activeGoal: this.hasActiveGoal,
            needs: this.state.snapshot.needs,
            traits: this.state.snapshot.traits,
            projectFocusId: this.projectFocus?.id ?? null,
        };
    }

    start(): void {
        if (this.timer !== null || !this.options.config.enabled) return;
        this.timer = this.clock.setInterval(
            () => this.tickSafely(),
            this.options.config.goalCadenceMilliseconds,
        );
        this.tickSafely();
    }

    stop(): void {
        if (this.timer === null) return;
        this.clock.clearInterval(this.timer);
        this.timer = null;
    }

    restore(): Result<void, string> {
        if (!this.options.config.enabled) return [undefined, null];
        const intention = this.state.snapshot.intention;
        if (intention === null) return [undefined, null];
        const [state, stateError] = this.readSnapshot();
        if (stateError) return [null, stateError];
        if (state === null) return [null, 'snapshot returned null'];
        const [goals, goalError] = this.generator.generate(
            state.snapshot,
            state.needs,
            state.traits,
            RoutineModel.phase(state.snapshot.timeOfDay),
            this.options.config.nightPrep,
        );
        if (goalError) return [null, goalError];
        if (goals === null) return [null, 'goal generation returned null'];
        const goal = goals.find((candidate) => candidate.id === intention.goalId) ?? null;
        if (goal === null || !this.canRestore(goal, state.snapshot)) {
            this.abandonRestored(goal, intention, 'infeasible');
            return [undefined, null];
        }
        const [restored, restoreError] = this.agent.restore(goal, intention);
        if (restoreError) return [null, restoreError];
        if (restored === null) return [null, 'intention restore returned null'];
        if (restored.stepIndex >= goal.steps.length) {
            const [, completeError] = this.completeGoal(
                goal,
                state.snapshot,
                new Date(this.now()).toISOString(),
            );
            if (completeError) return [null, completeError];
            return [undefined, null];
        }
        this.state = this.state.withIntention(restored);
        this.progressSinceDeadline = 0;
        this.lastProgressAt = this.now();
        this.applyAgencyFocus(restored.goalId, restored.label, new Date(this.now()).toISOString());
        this.persist(this.now(), true);
        return [undefined, null];
    }

    async tick(nowMilliseconds = this.now()): Promise<Result<AgencyTickReport, string>> {
        if (!this.options.config.enabled) {
            return [{ action: 'disabled', goalId: null }, null];
        }
        if (this.options.isPaused?.() === true) {
            return [{ action: 'paused', goalId: null }, null];
        }
        const [state, stateError] = this.readSnapshot();
        if (stateError) return [null, stateError];
        if (state === null) return [null, 'snapshot returned null'];
        this.applyElapsed(nowMilliseconds, state.snapshot.timeOfDay);
        const now = this.iso(nowMilliseconds);
        this.reportNightReadiness(state.snapshot, now);
        const active = this.agent.intention;
        if (active !== null) {
            const goal = this.agent.goal;
            if (goal === null) return [null, 'active intention has no goal'];
            if (this.options.skills.activeSkillId !== null) {
                const [watchdog, watchdogError] = this.checkProgressWatchdog(
                    goal,
                    state.snapshot,
                    nowMilliseconds,
                );
                if (watchdogError) return [null, watchdogError];
                if (watchdog !== null) return [watchdog, null];
                return [{ action: 'running', goalId: goal.id }, null];
            }
            if (GoalDeadlinePolicy.expired(active.deadline, now)) {
                const [extended, extendError] = this.extendDeadline(goal, active);
                if (extendError) return [null, extendError];
                if (extended !== null) {
                    this.state = this.state.withIntention(extended);
                    this.options.trace?.record('decision', 'agency.deadline.extended', {
                        goalId: goal.id,
                        deadline: extended.deadline,
                    });
                    return this.continueGoal(goal, extended, state.snapshot, now);
                }
                this.options.trace?.record('decision', 'agency.deadline.abandoned', {
                    goalId: goal.id,
                    deadline: active.deadline,
                });
                return this.abandonGoal(goal, 'deadline', now);
            }
            const [switched, switchError] = await this.agent.reconsider(now);
            if (switchError) return [null, switchError];
            if (switched !== null) {
                return this.switchGoal(goal, switched, state.snapshot, nowMilliseconds, now);
            }
            return this.continueGoal(goal, active, state.snapshot, now);
        }
        if (this.options.isProjectTaskActive?.() === true) {
            return [{ action: 'project', goalId: null }, null];
        }
        if (this.options.isJobActive?.() === true) {
            return [{ action: 'job', goalId: null }, null];
        }
        if (this.options.skills.activeSkillId !== null) {
            return [{ action: 'busy', goalId: null }, null];
        }
        const [tick, tickError] = await this.agent.tick(now);
        if (tickError) return [null, tickError];
        if (tick === null) {
            if (this.focus?.kind === 'project') {
                this.persist(nowMilliseconds, true);
                return [{ action: 'project', goalId: null }, null];
            }
            return [null, 'agent tick returned null'];
        }
        this.state = this.state.withIntention(tick.intention).touchDeliberation(now);
        this.progressSinceDeadline = 0;
        this.lastProgressAt = nowMilliseconds;
        this.applyAgencyFocus(tick.goalId, tick.goal.label, now);
        this.persist(nowMilliseconds, true);
        this.options.persistence.episode({
            goalId: tick.goalId,
            kind: 'goal.started',
            summary: `Started ${tick.goal.label}`,
            position: state.snapshot.position,
            payload: {
                kind: tick.goal.kind,
                source: tick.goal.source,
                consultLaya: tick.consultLaya,
            },
            at: now,
        });
        this.recordGoalStarted(tick.goal);
        return this.executeCurrentStep(tick.goal, tick.intention, state.snapshot, now);
    }

    observeProgress(event: SkillProgressEvent): void {
        if (!this.options.config.enabled || this.launching || this.watchdogPreempting) return;
        if (this.options.isPaused?.() === true) return;
        this.lastProgressAt = Date.parse(event.at);
        this.progressSinceDeadline += 1;
        const goal = this.agent.goal;
        const intention = this.agent.intention;
        if (goal === null || intention === null) return;
        if (event.taskId !== goal.id) return;
        const step = goal.steps[intention.stepIndex];
        if (step === undefined || step.skillId !== event.skillId) return;
        if (event.status === 'running') return;
        const [state, stateError] = this.readSnapshot();
        if (stateError || state === null) {
            this.options.logger.warn({ error: stateError }, 'agency progress snapshot failed');
            return;
        }
        if (event.status === 'completed') {
            const [next, advanceError] = this.agent.advance(event.at);
            if (advanceError) {
                this.options.logger.warn(
                    { error: advanceError },
                    'agency intention advance failed',
                );
                return;
            }
            if (next === null) return;
            this.state = this.state.withIntention(next);
            this.persist(this.now());
            const [, reportError] = this.executeCurrentStep(goal, next, state.snapshot, event.at);
            if (reportError) {
                this.options.logger.warn({ error: reportError }, 'agency goal step failed');
            }
            return;
        }
        const [, failureError] = this.retryOrAbandon(
            goal,
            this.reasonFor(event.failureClass ?? event.status),
            state.snapshot,
            event.at,
        );
        if (failureError) {
            this.options.logger.warn(
                { error: failureError },
                'agency goal failure handling failed',
            );
        }
    }

    private progressionGoal(snapshot: AgencySnapshot, now: string): Result<Goal | null, string> {
        const planner = this.options.progressionPlanner;
        if (planner === undefined || this.options.config.progression?.enabled === false) {
            return [null, null];
        }
        const [plan, planError] = this.progressionPlan(now);
        if (planError) return [null, planError];
        if (plan === null) return [null, 'progression plan returned null'];
        const [decision, decisionError] = planner.nextGoal(plan, snapshot);
        if (decisionError) return [null, decisionError];
        if (decision === null) return [null, 'progression decision returned null'];
        if (decision.plan.revision !== plan.revision) this.saveProgressionPlan(decision.plan);
        return [decision.goal, null];
    }

    private progressionPlan(now: string): Result<ProgressionPlan | null, string> {
        const memory = this.memory();
        const [restored, restoreError] = ProgressionPlanModel.restore(memory.progressionPlan, now);
        if (restoreError) return [null, restoreError];
        if (restored === null) return [null, 'progression plan restore returned null'];
        if (restored.migrated) {
            this.options.trace?.record('plan', 'plan-migrated', {
                version: ProgressionPlanModel.create(now).version,
            });
        }
        if (memory.progressionPlan === null || restored.migrated) {
            this.saveProgressionPlan(restored.plan);
        }
        return [restored.plan, null];
    }

    private saveProgressionPlan(plan: ProgressionPlan): void {
        const memory = this.memory().withProgressionPlan(plan);
        this.state = this.state.withWorkingMemory(memory.snapshot);
        this.persist(this.now(), true);
    }

    private observeProgression(goal: Goal, status: 'completed' | 'abandoned', now: string): void {
        const planner = this.options.progressionPlanner;
        if (planner === undefined || !goal.id.startsWith('goal:progression:')) return;
        const plan = this.memory().progressionPlan;
        if (plan === null || plan === undefined) return;
        const next = planner.observe(plan, { goal, status, at: now });
        if (next.revision !== plan.revision) this.saveProgressionPlan(next);
    }

    private switchGoal(
        previousGoal: Goal,
        tick: AgentLoopTick,
        snapshot: AgencySnapshot,
        nowMilliseconds: number,
        now: string,
    ): Result<AgencyTickReport, string> {
        if (this.options.skills.activeSkillId !== null) {
            const [, preemptError] = this.options.skills.preempt('goal switched');
            if (preemptError) return [null, preemptError];
        }
        this.state = this.state.withIntention(tick.intention).touchDeliberation(now);
        this.progressSinceDeadline = 0;
        this.lastProgressAt = nowMilliseconds;
        this.applyAgencyFocus(tick.goalId, tick.goal.label, now);
        this.observeProgression(previousGoal, 'abandoned', now);
        this.options.trace?.record('decision', 'agency.goal.switched', {
            previousGoalId: previousGoal.id,
            previousGoalKind: previousGoal.kind,
            goalId: tick.goalId,
            goalKind: tick.goal.kind,
        });
        this.recordGoalStarted(tick.goal);
        this.persist(nowMilliseconds, true);
        this.options.persistence.episode({
            goalId: previousGoal.id,
            kind: 'goal.abandoned',
            summary: `Abandoned ${previousGoal.label}: preempted by ${tick.goal.label}`,
            position: snapshot.position,
            payload: { kind: previousGoal.kind, reason: 'preempted', replacement: tick.goalId },
            at: now,
        });
        return this.executeCurrentStep(tick.goal, tick.intention, snapshot, now);
    }

    private recordGoalStarted(goal: Goal): void {
        this.options.trace?.record('decision', 'agency.goal.started', {
            goalId: goal.id,
            goalKind: goal.kind,
            source: goal.source,
            label: goal.label,
        });
        if (goal.kind === 'leisure') {
            this.options.trace?.record('plan', 'idle-life', {
                goalId: goal.id,
                plan: goal.label,
                target: goal.target,
            });
        }
    }

    private extendDeadline(goal: Goal, intention: Intention): Result<Intention | null, string> {
        if (intention.deadline === null || intention.deadlineExtended === true) {
            return [null, null];
        }
        if (intention.stepIndex === 0 && this.progressSinceDeadline === 0) return [null, null];
        const deadline = GoalDeadlinePolicy.extend(
            intention.deadline,
            goal.kind,
            this.options.config.goalDeadlines,
        );
        if (deadline === null) return [null, null];
        const [extended, extendError] = this.agent.extendDeadline(deadline);
        if (extendError) return [null, extendError];
        this.progressSinceDeadline = 0;
        return [extended, null];
    }

    private checkProgressWatchdog(
        goal: Goal,
        snapshot: AgencySnapshot,
        nowMilliseconds: number,
    ): Result<AgencyTickReport | null, string> {
        if (this.options.skills.activeSkillId === null) return [null, null];
        if (nowMilliseconds - this.lastProgressAt <= this.progressTimeoutMilliseconds) {
            return [null, null];
        }
        this.options.trace?.record('decision', 'agency.progress.watchdog', {
            goalId: goal.id,
            skillId: this.options.skills.activeSkillId,
            timeoutMilliseconds: this.progressTimeoutMilliseconds,
        });
        this.watchdogPreempting = true;
        const [, preemptError] = this.options.skills.preempt('progress timeout');
        this.watchdogPreempting = false;
        this.lastProgressAt = nowMilliseconds;
        if (preemptError) return [null, preemptError];
        return this.retryOrAbandon(
            goal,
            'infeasible',
            snapshot,
            new Date(nowMilliseconds).toISOString(),
        );
    }

    private continueGoal(
        goal: Goal,
        intention: Intention,
        snapshot: AgencySnapshot,
        now: string,
    ): Result<AgencyTickReport, string> {
        if (this.options.skills.activeSkillId !== null) {
            return [{ action: 'running', goalId: goal.id }, null];
        }
        return this.executeCurrentStep(goal, intention, snapshot, now);
    }

    private executeCurrentStep(
        goal: Goal,
        intention: Intention,
        snapshot: AgencySnapshot,
        now: string,
    ): Result<AgencyTickReport, string> {
        let current = intention;
        for (let guard = 0; guard <= goal.steps.length; guard += 1) {
            const step = goal.steps[current.stepIndex];
            if (step === undefined) return this.completeGoal(goal, snapshot, now);
            const [input, inputError] = this.skillInput(step.input, goal.id);
            if (inputError) {
                return this.retryOrAbandon(goal, 'infeasible', snapshot, now);
            }
            if (input === null) return [null, 'skill input returned null'];
            this.lastProgressAt = this.now();
            this.launching = true;
            const [skillStep, runError] = this.options.skills.run(step.skillId, input);
            this.launching = false;
            if (runError) {
                return this.retryOrAbandon(goal, 'infeasible', snapshot, now);
            }
            if (skillStep === null) return [null, 'skill returned null'];
            if (skillStep.status === 'running') {
                this.persist(this.now());
                return [{ action: 'running', goalId: goal.id }, null];
            }
            if (skillStep.status !== 'completed') {
                return this.retryOrAbandon(
                    goal,
                    this.reasonFor(skillStep.failure?.class ?? skillStep.status),
                    snapshot,
                    now,
                );
            }
            const [next, advanceError] = this.agent.advance(now);
            if (advanceError) return [null, advanceError];
            if (next === null) return [null, 'intention advance returned null'];
            current = next;
            this.state = this.state.withIntention(next);
        }
        return [null, 'goal step loop exceeded'];
    }

    private retryOrAbandon(
        goal: Goal,
        reason: AbandonmentReason,
        snapshot: AgencySnapshot,
        now: string,
    ): Result<AgencyTickReport, string> {
        const intention = this.agent.intention;
        if (intention !== null && intention.attempts < this.maximumAttempts) {
            const [retried, retryError] = this.agent.retry();
            if (retryError) return [null, retryError];
            if (retried !== null) this.state = this.state.withIntention(retried);
            this.lastProgressAt = Date.parse(now);
            this.persist(this.now(), true);
            const [, resumeError] = this.resumeCurrentStep(goal, retried ?? intention);
            if (resumeError !== null) {
                this.options.logger.debug(
                    { error: resumeError, goalId: goal.id },
                    'agency retry checkpoint unavailable',
                );
            }
            return [{ action: 'retry', goalId: goal.id }, null];
        }
        return this.abandonGoal(goal, reason, now);
    }

    private resumeCurrentStep(goal: Goal, intention: Intention): Result<SkillStep | null, string> {
        const step = goal.steps[intention.stepIndex];
        if (step === undefined) return [null, null];
        const [resumed, resumeError] = this.options.skills.resume(step.skillId, goal.id);
        if (resumeError) {
            this.options.trace?.record('decision', 'agency.retry.checkpoint', {
                goalId: goal.id,
                skillId: step.skillId,
                reason: resumeError,
            });
            return [null, resumeError];
        }
        return [resumed, null];
    }

    private completeGoal(
        goal: Goal,
        snapshot: AgencySnapshot,
        now: string,
    ): Result<AgencyTickReport, string> {
        const [intention, completeError] = this.agent.complete(now);
        if (completeError) return [null, completeError];
        if (intention === null) return [null, 'intention complete returned null'];
        const need = goalNeedFor(goal.kind);
        this.state = this.state.withIntention(null).satisfyNeed(need, NEED_SATISFACTION);
        this.observeProgression(goal, 'completed', now);
        const reflection = this.applyReflection(goal, intention, 'completed', null, now);
        this.restoreProjectFocus(now);
        if (goal.kind === 'eat' || goal.kind === 'rest') {
            this.state = this.state.withRoutine(
                RoutineModel.update(
                    this.state.snapshot.routine,
                    snapshot.timeOfDay,
                    goal.kind === 'eat' ? 'meal' : 'rest',
                    now,
                ),
            );
        }
        this.persist(this.now(), true);
        this.options.trace?.record('decision', 'agency.goal.completed', {
            goalId: goal.id,
            goalKind: goal.kind,
        });
        this.options.persistence.episode({
            goalId: goal.id,
            kind: 'goal.completed',
            summary: `Completed ${goal.label}`,
            position: snapshot.position,
            payload: { kind: goal.kind, reflection: AgencyRuntime.reflectionPayload(reflection) },
            at: now,
        });
        return [{ action: 'completed', goalId: goal.id }, null];
    }

    private abandonGoal(
        goal: Goal,
        reason: AbandonmentReason,
        now: string,
    ): Result<AgencyTickReport, string> {
        const [intention, abandonError] = this.agent.abandon(reason, now);
        if (abandonError) return [null, abandonError];
        if (intention === null) return [null, 'intention abandon returned null'];
        this.state = this.state.withIntention(null);
        this.observeProgression(goal, 'abandoned', now);
        const reflection = this.applyReflection(goal, intention, 'abandoned', reason, now);
        this.restoreProjectFocus(now);
        this.persist(this.now(), true);
        this.options.trace?.record('decision', 'agency.goal.abandoned', {
            goalId: goal.id,
            goalKind: goal.kind,
            reason,
        });
        this.options.persistence.episode({
            goalId: goal.id,
            kind: 'goal.abandoned',
            summary: `Abandoned ${goal.label}: ${reason}`,
            payload: {
                kind: goal.kind,
                reason,
                reflection: AgencyRuntime.reflectionPayload(reflection),
            },
            at: now,
        });
        return [{ action: 'abandoned', goalId: goal.id }, null];
    }

    private applyReflection(
        goal: Goal,
        intention: Intention,
        outcome: 'completed' | 'abandoned',
        reason: AbandonmentReason | null,
        now: string,
    ): ReflectionResult | null {
        const config = this.options.config.reflection;
        if (config?.enabled === false) return null;
        const [reflection, reflectionError] = ReflectionModel.reflect(
            {
                goal,
                intention,
                outcome,
                reason,
                traits: this.state.snapshot.traits,
            },
            { maxTraitDelta: config?.maxTraitDelta },
        );
        if (reflectionError) {
            this.options.logger.warn({ error: reflectionError }, 'agency reflection failed');
            return null;
        }
        if (reflection === null) return null;
        this.state = this.state.withTraits(reflection.traits).withMood(reflection.mood);
        this.state = this.state.withWorkingMemory(
            this.memory().withExperience({
                event: `goal.${outcome}:${goal.kind}`,
                outcome: reflection.summary,
                at: now,
            }).snapshot,
        );
        return reflection;
    }

    private static reflectionPayload(reflection: ReflectionResult | null) {
        if (reflection === null) return null;
        return {
            mood: reflection.mood,
            summary: reflection.summary,
            traitDeltas: reflection.traitDeltas,
        };
    }

    private applyAgencyFocus(goalId: string, label: string, at: string): void {
        const memory = this.memory();
        const current = memory.focus;
        let next = memory.withFocus({
            kind: 'agency',
            id: goalId,
            label,
            startedAt: at,
        });
        if (current?.kind === 'project') {
            next = next.withInterruption({
                reason: 'agency goal',
                resumeCondition: 'agency goal completes',
                interruptedFocusId: current.id,
                at,
            });
        }
        this.state = this.state.withWorkingMemory(next.snapshot);
    }

    private restoreProjectFocus(at: string): void {
        const memory = this.memory().withoutInterruption();
        if (this.project === null) {
            this.state = this.state.withWorkingMemory(memory.withoutFocus().snapshot);
            return;
        }
        this.state = this.state.withWorkingMemory(
            memory.withFocus({
                kind: 'project',
                id: this.project.id,
                label: this.project.title,
                startedAt: at,
            }).snapshot,
        );
    }

    private memory(): WorkingMemoryModel {
        const [memory] = WorkingMemoryModel.restore(
            this.state.snapshot.workingMemory,
            this.options.config.workingMemory,
        );
        return memory ?? WorkingMemoryModel.create(this.options.config.workingMemory);
    }

    private commitMemory(memory: WorkingMemoryModel): void {
        this.state = this.state.withWorkingMemory(memory.snapshot);
        this.persist(this.now(), true);
    }

    private reportNightReadiness(snapshot: AgencySnapshot, now: string): void {
        const config = this.options.config.nightPrep;
        if (config !== undefined && !config.enabled) return;
        const phase = RoutineModel.phase(snapshot.timeOfDay);
        if (!RoutineModel.isPreparationWindow(phase) && !RoutineModel.isNight(phase)) {
            this.lastNightReadinessKey = null;
            return;
        }
        const readiness = NightReadinessModel.assess(
            snapshot,
            phase,
            config ?? NightPrepDefaults.config(),
        );
        const key = [
            phase,
            readiness.shelterStrategy,
            readiness.nightIntent,
            readiness.gaps.join(','),
            readiness.actions.map((action) => action.kind).join(','),
        ].join(':');
        if (key === this.lastNightReadinessKey) return;
        this.lastNightReadinessKey = key;
        this.options.persistence.episode({
            goalId: null,
            kind: 'night.readiness',
            summary: `Night readiness: ${readiness.ready ? 'ready' : 'gaps'}`,
            position: snapshot.position,
            payload: {
                ready: readiness.ready,
                gaps: readiness.gaps,
                actions: readiness.actions,
                shelterStrategy: readiness.shelterStrategy,
                combat: readiness.combat,
                foodServings: readiness.foodServings,
                nightIntent: readiness.nightIntent,
            },
            at: now,
        });
        this.options.logger.info(
            {
                phase,
                ready: readiness.ready,
                gaps: readiness.gaps,
                shelterStrategy: readiness.shelterStrategy,
            },
            'night readiness assessed',
        );
    }

    private abandonRestored(
        goal: Goal | null,
        intention: Intention,
        reason: AbandonmentReason,
    ): void {
        const now = new Date(this.now()).toISOString();
        const reflection =
            goal === null ? null : this.applyReflection(goal, intention, 'abandoned', reason, now);
        this.state = this.state.withIntention(null);
        this.persist(this.now(), true);
        this.options.persistence.episode({
            goalId: intention.goalId,
            kind: 'goal.abandoned',
            summary: `Abandoned ${intention.label}: ${reason}`,
            payload: {
                reason,
                reflection: AgencyRuntime.reflectionPayload(reflection),
            },
            at: now,
        });
    }

    private applyElapsed(nowMilliseconds: number, timeOfDay: number | null): void {
        const elapsed = Math.max(0, nowMilliseconds - this.lastTickAt);
        this.lastTickAt = nowMilliseconds;
        if (elapsed > 0) {
            this.state = this.applyNeedDecay(elapsed);
        }
        this.state = this.state.withRoutine(
            RoutineModel.update(
                this.state.snapshot.routine,
                timeOfDay,
                null,
                this.iso(nowMilliseconds),
            ),
        );
    }

    private applyNeedDecay(elapsedMilliseconds: number): AgencyState {
        const perNeed = this.options.config.needDecayByNeed;
        if (perNeed !== undefined) {
            return this.state.decayNeedsByNeed(elapsedMilliseconds, perNeed);
        }
        return this.state.decayNeeds(elapsedMilliseconds, this.options.config.needDecayPerMinute);
    }

    private readSnapshot(): Result<
        {
            snapshot: AgencySnapshot;
            needs: AgencyState['snapshot']['needs'];
            traits: AgencyState['snapshot']['traits'];
            routine: AgencyState['snapshot']['routine'];
        },
        string
    > {
        const [snapshot, snapshotError] = this.options.context.read();
        if (snapshotError) return [null, snapshotError];
        if (snapshot === null) return [null, 'snapshot returned null'];
        return [
            {
                snapshot,
                needs: this.state.snapshot.needs,
                traits: this.state.snapshot.traits,
                routine: this.state.snapshot.routine,
            },
            null,
        ];
    }

    private skillInput(
        input: Readonly<Record<string, unknown>>,
        goalId: string,
    ): Result<SkillInput, string> {
        const parsed = skillInputSchema.safeParse({ ...input, taskId: goalId });
        if (!parsed.success) return [null, parsed.error.message];
        return [parsed.data, null];
    }

    private canRestore(goal: Goal, snapshot: AgencySnapshot): boolean {
        if (goal.kind === 'gather' && goal.target === null) return false;
        if (goal.kind === 'rest' && !snapshot.hasBed) return false;
        if (goal.target !== null) {
            const distance = Math.hypot(
                goal.target.x - snapshot.position.x,
                goal.target.y - snapshot.position.y,
                goal.target.z - snapshot.position.z,
            );
            if (distance > MAXIMUM_RESTORE_DISTANCE) return false;
        }
        return true;
    }

    private reasonFor(failureClass: string): AbandonmentReason {
        if (failureClass === 'unsafe') return 'unsafe';
        if (failureClass === 'preempted' || failureClass === 'cancelled') return 'preempted';
        return 'infeasible';
    }

    private persist(nowMilliseconds: number, force = false): void {
        if (!force && nowMilliseconds - this.lastPersistAt < this.telemetryMilliseconds) return;
        this.lastPersistAt = nowMilliseconds;
        this.options.persistence.save(this.state.snapshot, this.iso(nowMilliseconds));
    }

    private iso(nowMilliseconds: number): string {
        return new Date(nowMilliseconds).toISOString();
    }

    private tickSafely(): void {
        if (this.ticking) return;
        this.ticking = true;
        void attemptAsync(() => this.tick())
            .then(([, tickError]) => {
                if (tickError) this.options.logger.warn({ error: tickError }, 'agency tick failed');
            })
            .finally(() => {
                this.ticking = false;
            });
    }
}

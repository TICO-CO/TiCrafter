import {
    type AbandonmentReason,
    type AgencySnapshot,
    AgencyState,
    type Goal,
    GoalArbiter,
    GoalGenerator,
    goalNeedFor,
    type Intention,
    IntentionManager,
    RoutineModel,
} from '@ticrafter/agency';
import { type LoggerPort, type Result, skillInputSchema } from '@ticrafter/core';
import type { SkillInput, SkillProgressEvent, SkillStep } from '@ticrafter/skills';

import type { AgencyEpisodeInput } from './agency-state-adapter.js';
import { AgentLoop } from './agent-loop.js';

const DEFAULT_MAXIMUM_ATTEMPTS = 2;
const DEFAULT_TELEMETRY_MILLISECONDS = 5000;
const NEED_SATISFACTION = 0.6;
const MAXIMUM_RESTORE_DISTANCE = 128;

export interface AgencySkillPort {
    readonly activeSkillId: string | null;
    run(skillId: string, input: SkillInput): Result<SkillStep, string>;
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
    now?: () => number;
    maximumAttempts?: number;
    telemetryMilliseconds?: number;
}

export interface AgencyTickReport {
    action:
        'disabled' | 'paused' | 'job' | 'busy' | 'running' | 'completed' | 'abandoned' | 'retry';
    goalId: string | null;
}

export class AgencyRuntime {
    private readonly agent: AgentLoop;
    private readonly generator = new GoalGenerator();
    private readonly now: () => number;
    private readonly maximumAttempts: number;
    private readonly telemetryMilliseconds: number;
    private state: AgencyState;
    private timer: ReturnType<typeof setInterval> | null = null;
    private lastTickAt: number;
    private lastPersistAt = 0;
    private launching = false;

    private constructor(
        private readonly options: AgencyRuntimeOptions,
        state: AgencyState,
        arbiter: GoalArbiter,
    ) {
        this.state = state;
        this.now = options.now ?? Date.now;
        this.maximumAttempts = options.maximumAttempts ?? DEFAULT_MAXIMUM_ATTEMPTS;
        this.telemetryMilliseconds =
            options.telemetryMilliseconds ?? DEFAULT_TELEMETRY_MILLISECONDS;
        this.lastTickAt = this.now();
        this.agent = new AgentLoop({
            botId: options.botId,
            generator: this.generator,
            arbiter,
            intentions: new IntentionManager(),
            snapshots: { read: () => this.readSnapshot() },
        });
    }

    static create(
        options: AgencyRuntimeOptions,
        state: AgencyState,
    ): Result<AgencyRuntime, string> {
        const [arbiter, arbiterError] = GoalArbiter.create({
            commitmentBonus: options.config.committedGoalBonus,
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

    start(): void {
        if (this.timer !== null || !this.options.config.enabled) return;
        this.timer = setInterval(
            () => this.tickSafely(),
            this.options.config.goalCadenceMilliseconds,
        );
        this.tickSafely();
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
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
        );
        if (goalError) return [null, goalError];
        if (goals === null) return [null, 'goal generation returned null'];
        const goal = goals.find((candidate) => candidate.id === intention.goalId) ?? null;
        if (goal === null || !this.canRestore(goal, state.snapshot)) {
            this.abandonRestored(intention, 'infeasible');
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
        this.persist(this.now(), true);
        return [undefined, null];
    }

    tick(nowMilliseconds = this.now()): Result<AgencyTickReport, string> {
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
        const active = this.agent.intention;
        if (active !== null) {
            if (this.agent.expired(now)) {
                const goal = this.agent.goal;
                if (goal === null) return [null, 'active intention has no goal'];
                return this.abandonGoal(goal, 'expired', now);
            }
            const goal = this.agent.goal;
            if (goal === null) return [null, 'active intention has no goal'];
            return this.continueGoal(goal, active, state.snapshot, now);
        }
        if (this.options.isJobActive?.() === true) {
            return [{ action: 'job', goalId: null }, null];
        }
        if (this.options.skills.activeSkillId !== null) {
            return [{ action: 'busy', goalId: null }, null];
        }
        const [tick, tickError] = this.agent.tick(now);
        if (tickError) return [null, tickError];
        if (tick === null) return [null, 'agent tick returned null'];
        this.state = this.state.withIntention(tick.intention).touchDeliberation(now);
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
        return this.executeCurrentStep(tick.goal, tick.intention, state.snapshot, now);
    }

    observeProgress(event: SkillProgressEvent): void {
        if (!this.options.config.enabled || this.launching) return;
        if (this.options.isPaused?.() === true) return;
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
            this.persist(this.now(), true);
            return [{ action: 'retry', goalId: goal.id }, null];
        }
        return this.abandonGoal(goal, reason, now);
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
        this.options.persistence.episode({
            goalId: goal.id,
            kind: 'goal.completed',
            summary: `Completed ${goal.label}`,
            position: snapshot.position,
            payload: { kind: goal.kind },
            at: now,
        });
        return [{ action: 'completed', goalId: goal.id }, null];
    }

    private abandonGoal(
        goal: Goal,
        reason: AbandonmentReason,
        now: string,
    ): Result<AgencyTickReport, string> {
        const [, abandonError] = this.agent.abandon(reason, now);
        if (abandonError) return [null, abandonError];
        this.state = this.state.withIntention(null);
        this.persist(this.now(), true);
        this.options.persistence.episode({
            goalId: goal.id,
            kind: 'goal.abandoned',
            summary: `Abandoned ${goal.label}: ${reason}`,
            payload: { kind: goal.kind, reason },
            at: now,
        });
        return [{ action: 'abandoned', goalId: goal.id }, null];
    }

    private abandonRestored(intention: Intention, reason: AbandonmentReason): void {
        this.state = this.state.withIntention(null);
        this.persist(this.now(), true);
        this.options.persistence.episode({
            goalId: intention.goalId,
            kind: 'goal.abandoned',
            summary: `Abandoned ${intention.label}: ${reason}`,
            payload: { reason },
        });
    }

    private applyElapsed(nowMilliseconds: number, timeOfDay: number | null): void {
        const elapsed = Math.max(0, nowMilliseconds - this.lastTickAt);
        this.lastTickAt = nowMilliseconds;
        if (elapsed > 0) {
            this.state = this.state.decayNeeds(elapsed, this.options.config.needDecayPerMinute);
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
        const [, tickError] = this.tick();
        if (tickError) this.options.logger.warn({ error: tickError }, 'agency tick failed');
    }
}

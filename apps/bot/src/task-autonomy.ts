import {
    type JobMarketChoice,
    type JobMarketContext,
    JobMarketPolicy,
    type JobOfferView,
} from '@ticrafter/agency';
import type { Affordance, LayaDecision, PolicyState } from '@ticrafter/brains';
import {
    attemptAsync,
    BOT_JOB_DECIDE,
    BOT_JOB_OFFERS,
    botJobDecideResponseSchema,
    botJobOffersResponseSchema,
    type BotTaskResponse,
    botTaskResponseSchema,
    type DecisionRequest,
    type Envelope,
    type JobOfferPayload,
    type LoggerPort,
    type Result,
    type SessionResume,
    skillInputSchema,
    type StrategicConstraint,
    type StrategicGoalKind,
    TASK_CLAIM,
    TASK_COMPLETE,
    TASK_FAIL,
    TASK_RENEW,
    type TransportFailure,
} from '@ticrafter/core';
import type { SkillInput, SkillProgress, SkillStep } from '@ticrafter/skills';

import { FailureTaxonomy, type TaskFailureClass } from './failure-taxonomy.js';

const MAXIMUM_LABEL_WORDS = 12;
const INVENTORY_SLOTS = 36;
const LOW_FOOD = 18;

export interface TaskAutonomySnapshot {
    health: number;
    food: number;
    position: { x: number; y: number; z: number };
    inventory: readonly { name: string; count: number }[];
    hazards: readonly string[];
}

export interface TaskAutonomySnapshotPort {
    read(): TaskAutonomySnapshot;
}

export interface TaskAutonomyTransportPort {
    request(
        type: string,
        payload: unknown,
        timeoutMilliseconds?: number,
    ): Promise<Result<Envelope, TransportFailure>>;
}

export interface TaskDecisionPort {
    decide(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        state: PolicyState,
    ): Promise<Result<LayaDecision, string>>;
}

export interface TaskSkillPort {
    run(skillId: string, input: SkillInput): Result<SkillStep, string>;
    preempt(reason: string): Result<SkillStep | null, string>;
    readonly activeSkillId: string | null;
}

export interface TaskProgressObservation {
    taskId?: string;
    skillId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress: SkillProgress;
    failureClass?: string;
}

export interface TaskJobMarketPort {
    context: () => JobMarketContext;
}

export interface TaskTacticalContext {
    revision: number;
    focus: { kind: 'agency' | 'project' | 'task'; id: string; label: string } | null;
    commitments: readonly { id: string; description: string; priority: number }[];
    recentExperiences: readonly { event: string; outcome: string; at: string }[];
    interruption: {
        reason: string;
        resumeCondition: string;
        interruptedFocusId: string;
    } | null;
    strategicGoal: { kind: StrategicGoalKind; weight: number } | null;
    strategicConstraints: readonly StrategicConstraint[];
}

export interface TaskAutonomyOptions {
    botId: string;
    constructionPrefetch?: (input: SkillInput, skillId?: string) => Promise<Result<void, string>>;
    transport: TaskAutonomyTransportPort;
    jobMarket?: TaskJobMarketPort;
    decisions: TaskDecisionPort;
    tacticalContext?: () => TaskTacticalContext;
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
    skills: TaskSkillPort;
    snapshot: TaskAutonomySnapshotPort;
    logger: LoggerPort;
    canClaim?: () => boolean;
    tickMilliseconds?: number;
    timeoutMilliseconds?: number;
    renewMilliseconds?: number;
    now?: () => number;
}

interface ActiveTask {
    id: string;
    title: string;
    skillId: string;
    input: SkillInput;
    payload: Readonly<Record<string, unknown>>;
    projectId: string | null;
    fencingToken: number;
    leaseUntil: string | null;
    progress: number;
    lastRenewAt: number;
}

export class TaskAutonomy {
    private timer: ReturnType<typeof setInterval> | null = null;
    private active: ActiveTask | null = null;
    private busy = false;
    private closed = false;
    private paused = false;
    private readonly tickMilliseconds: number;
    private readonly timeoutMilliseconds: number;
    private readonly renewMilliseconds: number;
    private readonly now: () => number;

    constructor(private readonly options: TaskAutonomyOptions) {
        this.tickMilliseconds = options.tickMilliseconds ?? 1000;
        this.timeoutMilliseconds = options.timeoutMilliseconds ?? 5000;
        this.renewMilliseconds = options.renewMilliseconds ?? 15_000;
        this.now = options.now ?? Date.now;
    }

    start(): void {
        if (this.timer !== null) return;
        this.closed = false;
        this.paused = false;
        this.timer = setInterval(() => this.tickSafely(), this.tickMilliseconds);
        this.tickSafely();
    }

    stop(): void {
        this.closed = true;
        this.paused = false;
        this.clearTimer();
    }

    pause(reason: string): void {
        if (this.closed || this.paused) return;
        this.paused = true;
        this.clearTimer();
        this.options.logger.info({ reason }, 'task autonomy paused');
    }

    resume(): void {
        if (this.closed || !this.paused) return;
        this.paused = false;
        this.timer = setInterval(() => this.tickSafely(), this.tickMilliseconds);
        this.tickSafely();
    }

    get hasActiveTask(): boolean {
        return this.active !== null;
    }

    get activeTaskPayload(): Readonly<Record<string, unknown>> | null {
        return this.active?.payload ?? null;
    }

    get activeTaskProjectId(): string | null {
        return this.active?.projectId ?? null;
    }

    get activeTaskClaim(): { id: string; expiresAt: string } | null {
        const claimId = this.active?.payload.claimId;
        const expiresAt = this.active?.leaseUntil;
        if (typeof claimId !== 'string' || claimId.length === 0) return null;
        if (typeof expiresAt !== 'string' || expiresAt.length === 0) return null;
        return { id: claimId, expiresAt };
    }

    get activeTaskBounds(): {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    } | null {
        const bbox = this.active?.payload.bbox;
        if (typeof bbox !== 'object' || bbox === null) return null;
        const record = bbox as Record<string, unknown>;
        const min = TaskAutonomy.position(record.min);
        const max = TaskAutonomy.position(record.max);
        if (min === null || max === null) return null;
        return { min, max };
    }

    private static position(value: unknown): { x: number; y: number; z: number } | null {
        if (typeof value !== 'object' || value === null) return null;
        const record = value as Record<string, unknown>;
        const { x, y, z } = record;
        if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            typeof z !== 'number' ||
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(z)
        ) {
            return null;
        }
        return { x, y, z };
    }

    resumeTask(resume: SessionResume): boolean {
        if (this.closed) return false;
        if (resume.task === null || resume.fencingToken === null) return false;
        const prepared = TaskAutonomy.prepare({
            ok: true,
            task: resume.task,
            fencingToken: resume.fencingToken,
            leaseUntil: resume.leaseUntil,
        });
        if (prepared === null) return false;
        prepared.lastRenewAt = this.now();
        this.active = prepared;
        return true;
    }

    observeProgress(event: TaskProgressObservation): void {
        if (this.closed || this.paused) return;
        const active = this.active;
        if (active === null) return;
        if (event.taskId !== active.id) return;
        if (event.status === 'running') {
            active.progress = TaskAutonomy.progressRatio(event.progress);
            return;
        }
        if (event.skillId !== active.skillId) {
            active.progress = TaskAutonomy.progressRatio(event.progress);
            return;
        }
        if (event.status === 'completed') {
            void this.completeActive(active);
            return;
        }
        this.failActive(
            active,
            FailureTaxonomy.taskClassForSkill(event.failureClass ?? event.status),
            {
                ...event,
                reason: event.failureClass ?? event.status,
            },
        );
    }

    private tickSafely(): void {
        void attemptAsync(() => this.tick());
    }

    private async tick(): Promise<void> {
        if (this.closed || this.paused || this.busy) return;
        this.busy = true;
        await attemptAsync(() => this.runTick());
        this.busy = false;
    }

    private clearTimer(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    private async runTick(): Promise<void> {
        const active = this.active;
        if (active === null) {
            await this.claim();
            return;
        }
        if (this.options.skills.activeSkillId !== null) {
            await this.renewIfDue(active);
            return;
        }
        await this.startTaskSkill(active);
    }

    private async claim(): Promise<void> {
        if (this.options.canClaim?.() === false) return;
        if (this.options.jobMarket !== undefined) {
            await this.claimOffer();
            return;
        }
        const snapshot = this.options.snapshot.read();
        const [envelope, requestError] = await this.options.transport.request(
            TASK_CLAIM,
            {
                botId: this.options.botId,
                at: new Date(this.now()).toISOString(),
                position: snapshot.position,
                inventory: snapshot.inventory.map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
            },
            this.timeoutMilliseconds,
        );
        if (requestError || envelope === null) return;
        const parsed = botTaskResponseSchema.safeParse(envelope.payload);
        if (!parsed.success || !parsed.data.ok || parsed.data.task === null) return;
        if (parsed.data.fencingToken === null) return;
        const prepared = TaskAutonomy.prepare(parsed.data);
        if (prepared === null) return;
        this.active = prepared;
        await this.startTaskSkill(prepared);
    }

    private async claimOffer(): Promise<void> {
        const market = this.options.jobMarket;
        if (market === undefined) return;
        const snapshot = this.options.snapshot.read();
        const context = market.context();
        const [envelope, requestError] = await this.options.transport.request(
            BOT_JOB_OFFERS,
            {
                botId: this.options.botId,
                at: new Date(this.now()).toISOString(),
                role: context.role,
                position: snapshot.position,
                inventory: snapshot.inventory.map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
            },
            this.timeoutMilliseconds,
        );
        if (requestError || envelope === null) return;
        const parsed = botJobOffersResponseSchema.safeParse(envelope.payload);
        if (!parsed.success || !parsed.data.ok) return;
        for (const offer of parsed.data.offers) {
            const choice = JobMarketPolicy.decide(this.offerView(offer), context);
            const accepted = await this.resolveOffer(offer, choice);
            if (accepted !== null) {
                this.active = accepted;
                await this.startTaskSkill(accepted);
                return;
            }
        }
    }

    private async resolveOffer(
        offer: JobOfferPayload,
        choice: JobMarketChoice,
    ): Promise<ActiveTask | null> {
        const context = this.options.jobMarket?.context();
        if (context === undefined) return null;
        const snapshot = this.options.snapshot.read();
        const [envelope, requestError] = await this.options.transport.request(
            BOT_JOB_DECIDE,
            {
                botId: this.options.botId,
                taskId: offer.taskId,
                decision: choice.decision,
                reason: choice.reason,
                role: context.role,
                position: snapshot.position,
                inventory: snapshot.inventory.map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
            },
            this.timeoutMilliseconds,
        );
        if (requestError || envelope === null) return null;
        const parsed = botJobDecideResponseSchema.safeParse(envelope.payload);
        if (!parsed.success || !parsed.data.ok) return null;
        if (choice.decision !== 'accept') return null;
        if (parsed.data.task === null || parsed.data.fencingToken === null) return null;
        return TaskAutonomy.prepare({
            ok: true,
            taskId: parsed.data.taskId,
            task: parsed.data.task,
            fencingToken: parsed.data.fencingToken,
            leaseUntil: parsed.data.leaseUntil,
        });
    }

    private offerView(offer: JobOfferPayload): JobOfferView {
        return {
            taskId: offer.taskId,
            title: offer.title,
            priority: offer.priority,
            skillId: offer.skillId,
            requiredRole: offer.requiredRole,
            distance: offer.distance,
            projectId: offer.projectId ?? null,
        };
    }

    private async startTaskSkill(active: ActiveTask): Promise<void> {
        const snapshot = this.options.snapshot.read();
        const affordances = this.affordances(active, snapshot);
        const tactical = this.options.tacticalContext?.();
        const request = this.decisionRequest(active, snapshot, affordances, tactical);
        const [decision, decisionError] = await this.options.decisions.decide(
            request,
            affordances,
            TaskAutonomy.policyState(snapshot),
        );
        if (decisionError || decision === null) {
            this.failActive(active, 'transient', {
                reason: decisionError ?? 'no legal affordance',
            });
            return;
        }
        const applied = this.acceptedDecision(active, decision, affordances, tactical);
        this.options.recordTacticalDecision?.({
            choiceId: applied.choice.id,
            source: applied.source,
            revision: tactical?.revision ?? 0,
            at: new Date(this.now()).toISOString(),
        });
        const skillInput: SkillInput = { ...applied.choice.input, taskId: active.id };
        if (
            (applied.choice.skillId === 'construction' ||
                applied.choice.skillId === 'procurement') &&
            this.options.constructionPrefetch !== undefined
        ) {
            const [, prefetchError] = await this.options.constructionPrefetch(
                skillInput,
                applied.choice.skillId,
            );
            if (prefetchError !== null) {
                this.failActive(active, 'precondition', { reason: prefetchError });
                return;
            }
        }
        const [step, runError] = this.options.skills.run(applied.choice.skillId, skillInput);
        if (runError || step === null) {
            this.failActive(active, 'precondition', { reason: runError ?? 'skill returned null' });
            return;
        }
        if (step.status === 'completed' && applied.choice.skillId === active.skillId) {
            await this.completeActive(active);
        }
    }

    private async renewIfDue(active: ActiveTask): Promise<void> {
        const now = this.now();
        if (now - active.lastRenewAt < this.renewMilliseconds) return;
        active.lastRenewAt = now;
        const [envelope, requestError] = await this.options.transport.request(
            TASK_RENEW,
            {
                botId: this.options.botId,
                taskId: active.id,
                fencingToken: active.fencingToken,
            },
            this.timeoutMilliseconds,
        );
        if (requestError || envelope === null) return;
        const parsed = botTaskResponseSchema.safeParse(envelope.payload);
        if (!parsed.success || !parsed.data.ok) {
            this.options.skills.preempt('task lease lost');
            this.active = null;
        }
    }

    private async completeActive(active: ActiveTask): Promise<void> {
        if (this.active !== active) return;
        this.active = null;
        await this.options.transport.request(
            TASK_COMPLETE,
            {
                botId: this.options.botId,
                taskId: active.id,
                fencingToken: active.fencingToken,
            },
            this.timeoutMilliseconds,
        );
    }

    private failActive(
        active: ActiveTask,
        failureClass: TaskFailureClass,
        failure: { reason?: string; failureClass?: string },
    ): void {
        if (this.active !== active) return;
        this.active = null;
        void this.options.transport.request(
            TASK_FAIL,
            {
                botId: this.options.botId,
                taskId: active.id,
                fencingToken: active.fencingToken,
                failureClass,
                reason: failure.reason ?? failure.failureClass ?? 'task failed',
            },
            this.timeoutMilliseconds,
        );
    }

    private acceptedDecision(
        active: ActiveTask,
        decision: LayaDecision,
        affordances: readonly Affordance[],
        tactical: TaskTacticalContext | undefined,
    ): LayaDecision {
        if (decision.source !== 'laya' || tactical === undefined) return decision;
        const current = this.options.tacticalContext?.();
        if (
            current !== undefined &&
            current.revision === tactical.revision &&
            TaskAutonomy.focusKey(current.focus) === TaskAutonomy.focusKey(tactical.focus)
        ) {
            return decision;
        }
        this.options.recordTacticalDrop?.({
            choiceId: decision.choice.id,
            revision: tactical.revision,
            reason: 'working memory focus or revision changed',
            at: new Date(this.now()).toISOString(),
        });
        const fallback =
            affordances.find((affordance) => affordance.id === `task:${active.id}`) ??
            affordances[0];
        if (fallback === undefined) return decision;
        return {
            choice: fallback,
            source: 'fallback',
            confidence: 0,
            danger: decision.danger,
            shouldContinue: true,
            latencyMilliseconds: 0,
            reason: 'stale tactical decision discarded',
        };
    }

    private static focusKey(
        focus: { kind: 'agency' | 'project' | 'task'; id: string } | null,
    ): string | null {
        if (focus === null) return null;
        return `${focus.kind}:${focus.id}`;
    }

    private decisionRequest(
        active: ActiveTask,
        snapshot: TaskAutonomySnapshot,
        affordances: readonly Affordance[],
        tactical: TaskTacticalContext | undefined,
    ): DecisionRequest {
        return {
            botId: this.options.botId,
            at: new Date(this.now()).toISOString(),
            digest: {
                health: snapshot.health,
                food: snapshot.food,
                position: snapshot.position,
                inventoryCount: snapshot.inventory.length,
                currentSkill: this.options.skills.activeSkillId ?? undefined,
                decisionKind: 'task',
                inventorySummary: snapshot.inventory.slice(0, 5).map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
                hazards: [...snapshot.hazards],
                taskId: active.id,
                taskProgress: active.progress,
                ...(tactical === undefined
                    ? {}
                    : {
                          workingMemoryRevision: tactical.revision,
                          focus: tactical.focus,
                          commitments: [...tactical.commitments],
                          recentExperiences: tactical.recentExperiences.slice(-5),
                          interruption: tactical.interruption,
                          strategicGoal: tactical.strategicGoal,
                          strategicConstraints: [...tactical.strategicConstraints],
                      }),
            },
            affordances: affordances.map((affordance) => ({
                id: affordance.id,
                skillId: affordance.skillId,
                label: affordance.label ?? affordance.reason,
                priority: affordance.priority,
            })),
        };
    }

    private affordances(active: ActiveTask, snapshot: TaskAutonomySnapshot): readonly Affordance[] {
        const affordances: Affordance[] = [
            {
                id: `task:${active.id}`,
                skillId: active.skillId,
                input: active.input,
                reason: TaskAutonomy.label(active.title),
                label: TaskAutonomy.label(active.title),
                priority: 100,
            },
        ];
        const slotsUsed = snapshot.inventory.reduce((sum, item) => sum + item.count, 0);
        if (snapshot.food < LOW_FOOD) {
            affordances.push({
                id: 'survival:eat',
                skillId: 'eat',
                input: {},
                reason: 'Eat food to restore hunger',
                label: 'Eat food to restore hunger',
                priority: 90,
            });
        }
        if (snapshot.hazards.length > 0) {
            affordances.push({
                id: 'survival:flee',
                skillId: 'flee-defend',
                input: {},
                reason: 'Retreat from nearby hostile mobs',
                label: 'Retreat from nearby hostile mobs',
                priority: 95,
            });
        }
        if (slotsUsed >= INVENTORY_SLOTS) {
            affordances.push({
                id: 'survival:deposit',
                skillId: 'deposit',
                input: {},
                reason: 'Deposit surplus inventory in storage',
                label: 'Deposit surplus inventory in storage',
                priority: 80,
            });
        }
        return affordances;
    }

    private static prepare(response: BotTaskResponse): ActiveTask | null {
        const task = response.task;
        if (task === null || response.fencingToken === null) return null;
        const skillId = task.payload.skillId;
        if (typeof skillId !== 'string' || skillId.length === 0) return null;
        const { skillId: _skillId, ...rest } = task.payload;
        const parsed = skillInputSchema.safeParse(rest);
        if (!parsed.success) return null;
        const payloadProjectId = task.payload.projectId;
        const projectId =
            task.projectId ??
            (typeof payloadProjectId === 'string' && payloadProjectId.length > 0
                ? payloadProjectId
                : null);
        return {
            id: task.id,
            title: task.title,
            skillId,
            input: parsed.data,
            payload: task.payload,
            projectId,
            fencingToken: response.fencingToken,
            leaseUntil: response.leaseUntil,
            progress: 0,
            lastRenewAt: 0,
        };
    }

    private static policyState(snapshot: TaskAutonomySnapshot): PolicyState {
        const inventoryUsedRatio = Math.min(
            1,
            snapshot.inventory.reduce((sum, item) => sum + item.count, 0) / INVENTORY_SLOTS,
        );
        return {
            health: snapshot.health,
            food: snapshot.food,
            nearestHostileDistance: snapshot.hazards.length > 0 ? 1 : null,
            inventoryUsedRatio,
        };
    }

    private static progressRatio(progress: SkillProgress): number {
        if (progress.total <= 0) return 0;
        return Math.min(1, Math.max(0, progress.done / progress.total));
    }

    private static label(title: string): string {
        const words = title
            .trim()
            .split(/\s+/)
            .filter((word) => word.length > 0);
        if (words.length === 0) return 'Continue assigned task';
        return words.slice(0, MAXIMUM_LABEL_WORDS).join(' ');
    }
}

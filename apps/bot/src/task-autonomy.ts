import type { Affordance, LayaDecision, PolicyState } from '@ticrafter/brains';
import {
    attemptAsync,
    type BotTaskResponse,
    botTaskResponseSchema,
    type DecisionRequest,
    type Envelope,
    type LoggerPort,
    type Result,
    skillInputSchema,
    TASK_CLAIM,
    TASK_COMPLETE,
    TASK_FAIL,
    TASK_RENEW,
    type TransportFailure,
} from '@ticrafter/core';
import type { SkillInput, SkillProgress, SkillStep } from '@ticrafter/skills';

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

export interface TaskAutonomyOptions {
    botId: string;
    transport: TaskAutonomyTransportPort;
    decisions: TaskDecisionPort;
    skills: TaskSkillPort;
    snapshot: TaskAutonomySnapshotPort;
    logger: LoggerPort;
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
        this.timer = setInterval(() => this.tickSafely(), this.tickMilliseconds);
        this.tickSafely();
    }

    stop(): void {
        this.closed = true;
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    observeProgress(event: TaskProgressObservation): void {
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
        this.failActive(active, 'transient', {
            ...event,
            reason: event.failureClass ?? event.status,
        });
    }

    private tickSafely(): void {
        void attemptAsync(() => this.tick());
    }

    private async tick(): Promise<void> {
        if (this.closed || this.busy) return;
        this.busy = true;
        await attemptAsync(() => this.runTick());
        this.busy = false;
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

    private async startTaskSkill(active: ActiveTask): Promise<void> {
        const snapshot = this.options.snapshot.read();
        const affordances = this.affordances(active, snapshot);
        const request = this.decisionRequest(active, snapshot, affordances);
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
        const [step, runError] = this.options.skills.run(decision.choice.skillId, {
            ...decision.choice.input,
            taskId: active.id,
        });
        if (runError || step === null) {
            this.failActive(active, 'precondition', { reason: runError ?? 'skill returned null' });
            return;
        }
        if (step.status === 'completed' && decision.choice.skillId === active.skillId) {
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
        failureClass: 'transient' | 'precondition' | 'blocked' | 'invalid' | 'fatal',
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

    private decisionRequest(
        active: ActiveTask,
        snapshot: TaskAutonomySnapshot,
        affordances: readonly Affordance[],
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
                inventorySummary: snapshot.inventory.slice(0, 5).map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
                hazards: [...snapshot.hazards],
                taskId: active.id,
                taskProgress: active.progress,
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
        return {
            id: task.id,
            title: task.title,
            skillId,
            input: parsed.data,
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

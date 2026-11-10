import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';

export type SkillStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type SkillFailureClass =
    | 'invalid-input'
    | 'unsafe'
    | 'no-path'
    | 'missing-item'
    | 'missing-tool'
    | 'target-missing'
    | 'timeout'
    | 'preempted'
    | 'cancelled'
    | 'execution-failed';

export interface SkillFailure {
    class: SkillFailureClass;
    message: string;
}

export interface SkillInventoryItem {
    name: string;
    count: number;
}

export interface SkillHostile {
    entityId?: number;
    name: string;
    position: Vec3;
    distance: number;
}

export interface SkillWorldView {
    blockAt(position: Vec3): string | null;
    nearestContainer(maxDistance: number): Vec3 | null;
}

export interface SkillContext {
    botId: string;
    at: string;
    position: Vec3;
    health: number;
    food: number;
    inventory: readonly SkillInventoryItem[];
    world: SkillWorldView;
    nearestHostile: SkillHostile | null;
    lastAction: ActionOutcome | null;
}

export interface SkillInput {
    target?: Vec3;
    waypoints?: readonly Vec3[];
    itemName?: string;
    count?: number;
    radius?: number;
    range?: number;
    threshold?: number;
    container?: Vec3;
}

export interface SkillProgress {
    done: number;
    total: number;
    label: string;
}

export interface SkillRun {
    skillId: string;
    state: Record<string, unknown>;
}

export interface SkillStep {
    run: SkillRun;
    status: SkillStatus;
    action: ActionRequest | null;
    progress: SkillProgress;
    failure: SkillFailure | null;
}

export interface SkillCheckpoint {
    botId: string;
    skillId: string;
    state: Record<string, unknown>;
    updatedAt: string;
}

export interface Skill {
    id: string;
    canRun(context: SkillContext, input: SkillInput): Result<boolean, string>;
    start(context: SkillContext, input: SkillInput): Result<SkillStep, string>;
    step(context: SkillContext, run: SkillRun): Result<SkillStep, string>;
    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string>;
    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string>;
    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string>;
}

export interface SkillContextSource {
    read(): Result<Omit<SkillContext, 'lastAction'>, string>;
}

export interface SkillProgressEvent {
    botId: string;
    at: string;
    skillId: string;
    status: SkillStatus;
    progress: SkillProgress;
    failureClass?: string;
}

export interface SkillProgressSink {
    report(event: SkillProgressEvent): Result<void, string>;
}

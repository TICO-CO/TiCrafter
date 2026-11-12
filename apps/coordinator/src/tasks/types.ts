import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import type { BlockPosition, BoundingBox, LandmarkType, WorldFailure } from '@ticrafter/worldmodel';

export type TaskStatus =
    | 'pending'
    | 'ready'
    | 'claimed'
    | 'running'
    | 'completed'
    | 'failed'
    | 'dead_letter'
    | 'cancelled';

export type TaskFailureClass = 'transient' | 'precondition' | 'blocked' | 'invalid' | 'fatal';

export type TaskRole = 'builder' | 'farmer' | 'miner' | 'scout' | 'hauler' | 'guard';

export type TaskPrecondition =
    | { kind: 'inventory.at-least'; item: string; quantity: number }
    | { kind: 'claim.free'; bbox: BoundingBox }
    | { kind: 'world.block'; position: BlockPosition; expectedBlockId?: string }
    | { kind: 'world.landmark'; bbox: BoundingBox; type?: LandmarkType };

export interface TaskRecord {
    id: string;
    parentId: string | null;
    title: string;
    status: TaskStatus;
    priority: number;
    retryCount: number;
    payload: Readonly<Record<string, unknown>>;
    dependencies: readonly string[];
    preconditions: readonly TaskPrecondition[];
    requiredRole: TaskRole | null;
    target: BlockPosition | null;
    claimedBy: string | null;
    leaseUntil: string | null;
    leaseToken: number | null;
    availableAt: string;
    failureClass: TaskFailureClass | null;
    deadLetterReason: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}

export interface CreateTaskInput {
    id: string;
    title: string;
    parentId?: string | null;
    priority?: number;
    payload?: Readonly<Record<string, unknown>>;
    dependencies?: readonly string[];
    preconditions?: readonly TaskPrecondition[];
    requiredRole?: TaskRole | null;
    target?: BlockPosition | null;
}

export interface TaskClaimContext {
    botId: string;
    botRole: TaskRole | null;
    botPosition: BlockPosition | null;
    inventory: Readonly<Record<string, number>>;
    activeTaskCount: number;
    world: TaskWorldPort;
    claims: TaskClaimPort;
}

export interface TaskLease {
    task: TaskRecord;
    fencingToken: number;
    leaseUntil: string;
}

export interface TaskWorldPort {
    blockAt(position: BlockPosition): Result<{ blockId: string } | null, WorldFailure>;
    intersecting(
        bbox: BoundingBox,
        type: LandmarkType | null,
    ): Result<readonly { id: string; type: LandmarkType }[], WorldFailure>;
}

export interface TaskClaimPort {
    hasActiveOverlap(bbox: BoundingBox): Result<boolean, string>;
    renewPackageClaim(
        claimId: string,
        fencingToken: number,
        now: string,
        leaseTtlMilliseconds: number,
    ): Result<void, string>;
}

export interface TaskPreconditionFailure {
    precondition: TaskPrecondition;
    reason: string;
}

export type TaskFailure =
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'DUPLICATE_TASK'; taskId: string }
    | { type: 'TASK_NOT_FOUND'; taskId: string }
    | { type: 'INVALID_TASK'; message: string }
    | { type: 'MALFORMED_TASK'; message: string }
    | { type: 'DEPENDENCY_CYCLE'; taskIds: readonly string[] }
    | { type: 'INVALID_TRANSITION'; taskId: string; from: TaskStatus; to: TaskStatus }
    | { type: 'PRECONDITION_FAILED'; taskId: string; failures: readonly TaskPreconditionFailure[] }
    | { type: 'CLAIM_CONFLICT'; taskId: string };

export type TaskRetryDecision =
    | { action: 'retry'; readyAt: string; retryCount: number }
    | { action: 'dead-letter'; reason: string };

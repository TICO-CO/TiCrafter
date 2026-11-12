import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { SipBlockPosition, SipBoundingBox } from '../sip/index.js';

export type ClaimResourceType =
    'structure' | 'work_package' | 'farm_plot' | 'container' | 'road_segment' | 'resource_area';

export type ClaimStatus = 'active' | 'released' | 'completed' | 'expired' | 'revoked';

export interface ClaimRecord {
    id: string;
    resourceType: ClaimResourceType;
    resourceId: string;
    bbox: SipBoundingBox;
    botId: string;
    leaseUntil: string;
    fencingToken: number;
    status: ClaimStatus;
    taskId: string | null;
    parentClaimId: string | null;
    epoch: number;
    payload: Readonly<Record<string, unknown>>;
    createdAt: string;
    updatedAt: string;
}

export interface AcquireClaimInput {
    id: string;
    resourceType: ClaimResourceType;
    resourceId: string;
    bbox: SipBoundingBox;
    botId: string;
    taskId?: string | null;
    parentClaimId?: string | null;
    payload?: Readonly<Record<string, unknown>>;
    leaseTtlMilliseconds?: number;
}

export interface ClaimSessionPort {
    isConnected(botId: string): boolean;
}

export interface ClaimTaskPort {
    requeue(taskId: string, actor: string, reason: string, now: string): Result<unknown, unknown>;
}

export interface ClaimContentionSnapshot {
    claimWaitMilliseconds: number;
    duplicateAttempts: number;
    reclaims: number;
    leaseChurn: number;
}

export type ClaimFailure =
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'CLAIM_NOT_FOUND'; claimId: string }
    | { type: 'INVALID_CLAIM'; message: string }
    | { type: 'MALFORMED_CLAIM'; message: string }
    | { type: 'OVERLAP'; claimIds: readonly string[] }
    | { type: 'STALE_TOKEN'; claimId: string; expected: number; actual: number }
    | { type: 'OWNER_MISMATCH'; claimId: string; botId: string }
    | { type: 'INVALID_STATUS'; claimId: string; status: ClaimStatus }
    | { type: 'SESSION_INVALID'; botId: string }
    | { type: 'TASK_REQUEUE_FAILED'; taskId: string; message: string };

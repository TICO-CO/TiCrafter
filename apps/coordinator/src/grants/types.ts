import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { ClaimRecord } from '../claims/index.js';
import type {
    SipBoundingBox,
    SipEditOperation,
    SipMaterialNeed,
    SipSnapshot,
    SipStructure,
} from '../sip/index.js';

export type EditGrantStatus = 'active' | 'expired' | 'revoked';

export type EditGrantAuthority = 'owner' | 'coordinator';

export interface EditGrantRecord {
    id: string;
    structureId: string;
    ownerBotId: string;
    granteeBotId: string;
    designRevision: number;
    bbox: SipBoundingBox;
    allowedOps: readonly SipEditOperation[];
    materialConstraints: readonly SipMaterialNeed[];
    intent: string;
    status: EditGrantStatus;
    expiresAt: string;
    fencingToken: number;
    epoch: number;
    grantedBy: EditGrantAuthority;
    taskId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface EditRequestInput {
    id: string;
    structureId: string;
    requesterBotId: string;
    observedDesignRevision: number;
    intent: string;
    proposedOps: readonly SipEditOperation[];
    bbox: SipBoundingBox;
    materialConstraints?: readonly SipMaterialNeed[];
    taskId?: string | null;
    ttlMilliseconds?: number;
}

export interface GrantAuthorizationInput {
    grantId: string;
    botId: string;
    fencingToken: number;
    bbox: SipBoundingBox;
    operations: readonly SipEditOperation[];
}

export interface GrantPresencePort {
    isOnline(botId: string): boolean;
}

export interface GrantSipPort {
    load(): Result<SipSnapshot, StorageFailure>;
}

export interface GrantClaimsPort {
    listActive(): Result<readonly ClaimRecord[], StorageFailure>;
}

export type GrantDenialReason =
    'structure_private' | 'owner_offline' | 'owner_policy_denied' | 'invalid_request';

export type GrantDecision =
    | { kind: 'allow'; grantedBy: EditGrantAuthority }
    | { kind: 'deny'; reason: GrantDenialReason; message: string }
    | { kind: 'owner-offline' };

export type GrantFailure =
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'INVALID_REQUEST'; message: string }
    | { type: 'STRUCTURE_NOT_FOUND'; structureId: string }
    | { type: 'DUPLICATE_GRANT'; grantId: string }
    | { type: 'GRANT_NOT_FOUND'; grantId: string }
    | { type: 'POLICY_DENIED'; reason: GrantDenialReason; message: string }
    | { type: 'REVISION_MISMATCH'; expected: number; actual: number }
    | { type: 'STALE_TOKEN'; grantId: string; expected: number; actual: number }
    | { type: 'STALE_EPOCH'; grantId: string; expected: number; actual: number }
    | { type: 'GRANTEE_MISMATCH'; grantId: string; botId: string }
    | { type: 'INVALID_STATUS'; grantId: string; status: EditGrantStatus }
    | { type: 'GRANT_EXPIRED'; grantId: string; expiresAt: string }
    | { type: 'OUT_OF_SCOPE'; message: string }
    | { type: 'OPERATION_NOT_GRANTED'; operations: readonly SipEditOperation[] }
    | { type: 'CLAIM_COLLISION'; claimIds: readonly string[] }
    | { type: 'COMPLETED_WORK_COLLISION'; workPackageIds: readonly string[] }
    | { type: 'PROTECTED_REGION'; message: string }
    | { type: 'NO_BUILD_ZONE'; message: string }
    | { type: 'ARBITRATION_UNAVAILABLE'; message: string };

export interface CompatibilityInput {
    structure: SipStructure;
    requesterBotId: string;
    observedDesignRevision: number;
    proposedOps: readonly SipEditOperation[];
    bbox: SipBoundingBox;
    snapshot: SipSnapshot;
    claims: readonly ClaimRecord[];
    allowCompletedWork: boolean;
}

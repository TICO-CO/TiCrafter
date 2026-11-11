import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import type {
    BoundingBox,
    DeviationFinding,
    IntendedStructure,
    Landmark,
} from '@ticrafter/worldmodel';

import type { SipProposalInput, SipSnapshot } from './types.js';

export interface SipReconciliationSnapshotPort {
    loadSnapshot(): Result<SipSnapshot, string>;
}

export interface SipReconciliationWorldPort {
    reconcile(intended: readonly IntendedStructure[]): Result<readonly DeviationFinding[], string>;
    intersecting(bbox: BoundingBox): Result<readonly Landmark[], string>;
}

export interface SipReconciliationCommitterPort {
    commit(input: SipProposalInput): Result<number, string>;
}

export interface SipReconciliationEventPort {
    append(event: {
        type: string;
        actor?: string;
        payload?: unknown;
    }): Result<number, StorageFailure>;
}

export interface SipProgressChange {
    structureId: string;
    previous: number;
    next: number;
}

export interface SipReconciliationReport {
    revision: number;
    structures: number;
    findings: readonly DeviationFinding[];
    progressChanges: readonly SipProgressChange[];
}

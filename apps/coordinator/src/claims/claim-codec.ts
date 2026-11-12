import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import { SipGeometry } from '../sip/index.js';
import type { ClaimRecord, ClaimResourceType, ClaimStatus } from './types.js';

export interface ClaimRow {
    id: string;
    resource: string;
    owner_bot_id: string;
    lease_expires_at: string;
    fencing_token: number;
    created_at: string;
    resource_type: string;
    bbox_json: string;
    status: string;
    task_id: string | null;
    parent_claim_id: string | null;
    epoch: number;
    payload_json: string;
    updated_at: string;
}

const resourceTypes = new Set<ClaimResourceType>([
    'structure',
    'work_package',
    'farm_plot',
    'container',
    'road_segment',
    'resource_area',
]);

const claimStatuses = new Set<ClaimStatus>([
    'active',
    'released',
    'completed',
    'expired',
    'revoked',
]);

export class ClaimCodec {
    static decode(row: ClaimRow): Result<ClaimRecord, StorageFailure> {
        if (!resourceTypes.has(row.resource_type as ClaimResourceType)) {
            return [null, this.failure(`unknown claim resource type: ${row.resource_type}`)];
        }
        if (!claimStatuses.has(row.status as ClaimStatus)) {
            return [null, this.failure(`unknown claim status: ${row.status}`)];
        }
        const [parsed, parseError] = attempt<ClaimRecord, unknown>(() => ({
            id: row.id,
            resourceType: row.resource_type as ClaimResourceType,
            resourceId: row.resource,
            bbox: JSON.parse(row.bbox_json),
            botId: row.owner_bot_id,
            leaseUntil: row.lease_expires_at,
            fencingToken: row.fencing_token,
            status: row.status as ClaimStatus,
            taskId: row.task_id,
            parentClaimId: row.parent_claim_id,
            epoch: row.epoch,
            payload: JSON.parse(row.payload_json) as Readonly<Record<string, unknown>>,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        if (parseError) return [null, this.failure(parseError)];
        if (parsed === null) return [null, this.failure('claim missing')];
        if (!SipGeometry.isValidBbox(parsed.bbox)) {
            return [null, this.failure(`claim ${row.id} has an invalid bbox`)];
        }
        return [parsed, null];
    }

    static encodeBbox(bbox: ClaimRecord['bbox']): string {
        return JSON.stringify(bbox);
    }

    static encodePayload(payload: Readonly<Record<string, unknown>>): string {
        return JSON.stringify(payload);
    }

    private static failure(error: unknown): StorageFailure {
        return StorageFailures.from('READ_FAILED', error);
    }
}

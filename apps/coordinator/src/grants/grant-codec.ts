import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';
import { z as zod } from 'zod';

import { SipGeometry } from '../sip/index.js';
import type { EditGrantRecord, EditGrantStatus } from './types.js';

export interface EditGrantRow {
    id: string;
    structure_id: string;
    owner_bot_id: string;
    grantee_bot_id: string;
    revision: number;
    status: string;
    expires_at: string;
    created_at: string;
    bbox_json: string;
    allowed_ops_json: string;
    material_constraints_json: string;
    intent: string;
    fencing_token: number;
    epoch: number;
    granted_by: string;
    task_id: string | null;
    updated_at: string;
}

const positionSchema = zod.object({
    x: zod.number().int(),
    y: zod.number().int(),
    z: zod.number().int(),
});

const bboxSchema = zod.object({
    min: positionSchema,
    max: positionSchema,
});

const operationSchema = zod.enum(['place', 'break', 'replace']);

const materialSchema = zod.object({
    item: zod.string().min(1),
    count: zod.number().int().nonnegative(),
});

const statuses = new Set<EditGrantStatus>(['active', 'expired', 'revoked']);
const authorities = new Set<EditGrantRecord['grantedBy']>(['owner', 'coordinator']);

export class EditGrantCodec {
    static decode(row: EditGrantRow): Result<EditGrantRecord, StorageFailure> {
        if (!statuses.has(row.status as EditGrantStatus)) {
            return [null, this.failure(`unknown grant status: ${row.status}`)];
        }
        if (!authorities.has(row.granted_by as EditGrantRecord['grantedBy'])) {
            return [null, this.failure(`unknown grant authority: ${row.granted_by}`)];
        }
        const [parsed, parseError] = attempt<EditGrantRecord, unknown>(() => ({
            id: row.id,
            structureId: row.structure_id,
            ownerBotId: row.owner_bot_id,
            granteeBotId: row.grantee_bot_id,
            designRevision: row.revision,
            bbox: bboxSchema.parse(JSON.parse(row.bbox_json)),
            allowedOps: zod.array(operationSchema).parse(JSON.parse(row.allowed_ops_json)),
            materialConstraints: zod
                .array(materialSchema)
                .parse(JSON.parse(row.material_constraints_json)),
            intent: row.intent,
            status: row.status as EditGrantStatus,
            expiresAt: row.expires_at,
            fencingToken: row.fencing_token,
            epoch: row.epoch,
            grantedBy: row.granted_by as EditGrantRecord['grantedBy'],
            taskId: row.task_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        if (parseError) return [null, this.failure(parseError)];
        if (parsed === null) return [null, this.failure('grant missing')];
        if (!SipGeometry.isValidBbox(parsed.bbox)) {
            return [null, this.failure(`grant ${row.id} has an invalid bbox`)];
        }
        return [parsed, null];
    }

    static encodeBbox(record: EditGrantRecord): string {
        return JSON.stringify(record.bbox);
    }

    static encodeAllowedOps(record: EditGrantRecord): string {
        return JSON.stringify(record.allowedOps);
    }

    static encodeMaterialConstraints(record: EditGrantRecord): string {
        return JSON.stringify(record.materialConstraints);
    }

    private static failure(error: unknown): StorageFailure {
        return StorageFailures.from('READ_FAILED', error);
    }
}

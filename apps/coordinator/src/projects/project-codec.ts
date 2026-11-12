import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import { SipGeometry } from '../sip/index.js';
import type {
    PersonalProjectKind,
    PersonalProjectRecord,
    PersonalProjectStatus,
    ProjectClaimReference,
} from './types.js';

export interface PersonalProjectRow {
    id: string;
    bot_id: string;
    title: string;
    kind: string;
    status: string;
    anchor_json: string;
    bbox_json: string;
    claims_json: string;
    structure_id: string | null;
    storage_id: string | null;
    reason: string | null;
    created_at: string;
    updated_at: string;
}

const projectKinds = new Set<PersonalProjectKind>(['home', 'storage', 'build']);
const projectStatuses = new Set<PersonalProjectStatus>([
    'proposed',
    'active',
    'completed',
    'abandoned',
    'failed',
]);

export class PersonalProjectCodec {
    static decode(row: PersonalProjectRow): Result<PersonalProjectRecord, StorageFailure> {
        if (!projectKinds.has(row.kind as PersonalProjectKind)) {
            return [null, this.failure(`unknown project kind: ${row.kind}`)];
        }
        if (!projectStatuses.has(row.status as PersonalProjectStatus)) {
            return [null, this.failure(`unknown project status: ${row.status}`)];
        }
        const [record, parseError] = attempt<PersonalProjectRecord, unknown>(() => ({
            id: row.id,
            botId: row.bot_id,
            title: row.title,
            kind: row.kind as PersonalProjectKind,
            status: row.status as PersonalProjectStatus,
            anchor: JSON.parse(row.anchor_json) as PersonalProjectRecord['anchor'],
            bbox: JSON.parse(row.bbox_json) as PersonalProjectRecord['bbox'],
            claims: JSON.parse(row.claims_json) as readonly ProjectClaimReference[],
            structureId: row.structure_id,
            storageId: row.storage_id,
            reason: row.reason,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        if (parseError) return [null, this.failure(parseError)];
        if (record === null) return [null, this.failure('project missing')];
        if (!SipGeometry.isValidBbox(record.bbox)) {
            return [null, this.failure(`project ${row.id} has an invalid bbox`)];
        }
        return [record, null];
    }

    static encodeClaims(claims: readonly ProjectClaimReference[]): string {
        return JSON.stringify(claims);
    }

    static encodeAnchor(anchor: PersonalProjectRecord['anchor']): string {
        return JSON.stringify(anchor);
    }

    static encodeBbox(bbox: PersonalProjectRecord['bbox']): string {
        return JSON.stringify(bbox);
    }

    private static failure(error: unknown): StorageFailure {
        return StorageFailures.from('READ_FAILED', error);
    }
}

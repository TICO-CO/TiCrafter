import {
    type ConstructionPlan,
    type ConstructionPlanDocument,
    ConstructionPlanDocumentHash,
    type ConstructionPlanPurpose,
} from '@ticrafter/building';
import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';

interface ConstructionPlanRow {
    id: string;
    revision: number;
    hash: string;
    structure_id: string;
    blueprint_id: string;
    blueprint_revision: number;
    purpose: string;
    plan_json: string;
    created_at: string;
}

const columnList = `
    id, revision, hash, structure_id, blueprint_id, blueprint_revision, purpose, plan_json, created_at
`;

export class ConstructionPlanRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    insert(document: ConstructionPlanDocument): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO construction_plans (
                        id, revision, hash, structure_id, blueprint_id, blueprint_revision,
                        purpose, plan_json, created_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    document.id,
                    document.revision,
                    document.hash,
                    document.structureId,
                    document.blueprintId,
                    document.blueprintRevision,
                    document.purpose,
                    JSON.stringify(document.plan),
                    document.createdAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(id: string, revision: number): Result<ConstructionPlanDocument | null, StorageFailure> {
        return this.read(
            `SELECT ${columnList} FROM construction_plans WHERE id = ? AND revision = ?`,
            id,
            revision,
        );
    }

    latest(id: string): Result<ConstructionPlanDocument | null, StorageFailure> {
        return this.read(
            `SELECT ${columnList} FROM construction_plans
             WHERE id = ? ORDER BY revision DESC LIMIT 1`,
            id,
        );
    }

    private read(
        sql: string,
        ...parameters: unknown[]
    ): Result<ConstructionPlanDocument | null, StorageFailure> {
        const [row, readError] = attempt<ConstructionPlanRow | undefined, unknown>(
            () => this.database.prepare(sql).get(...parameters) as ConstructionPlanRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return this.decode(row);
    }

    private decode(row: ConstructionPlanRow): Result<ConstructionPlanDocument, StorageFailure> {
        const [plan, parseError] = attempt<ConstructionPlan, unknown>(() =>
            JSON.parse(row.plan_json),
        );
        if (parseError) return [null, StorageFailures.from('READ_FAILED', parseError)];
        if (plan === null) return [null, StorageFailures.from('READ_FAILED', 'plan is missing')];
        const content = {
            id: row.id,
            revision: row.revision,
            structureId: row.structure_id,
            blueprintId: row.blueprint_id,
            blueprintRevision: row.blueprint_revision,
            purpose: parsePurpose(row.purpose),
            plan,
            createdAt: row.created_at,
        };
        const hash = ConstructionPlanDocumentHash.of(content);
        if (hash !== row.hash) {
            return [
                null,
                StorageFailures.from(
                    'READ_FAILED',
                    `construction plan ${row.id} revision ${row.revision} hash mismatch`,
                ),
            ];
        }
        return [{ ...content, hash: row.hash }, null];
    }
}

function parsePurpose(value: string): ConstructionPlanPurpose {
    if (value === 'repair' || value === 'rollback' || value === 'renovation') return value;
    return 'build';
}

import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export interface BlockChange {
    botId: string;
    position: { x: number; y: number; z: number };
    before?: unknown;
    after?: unknown;
    grantId?: string;
    grantFencingToken?: number;
    claimId?: string;
    taskId?: string;
    structureId?: string;
    blueprintId?: string;
    blueprintRevision?: number;
    workPackageId?: string;
    planId?: string;
    fencingToken?: number;
    phase?: string;
    authorized?: boolean;
    rejectionReason?: string;
    createdAt?: string;
}

export class BlockChangelogWriter {
    constructor(private readonly database: Database) {}

    append(change: BlockChange): Result<number, StorageFailure> {
        const [id, error] = attempt(() => {
            const result = this.database
                .prepare(
                    `INSERT INTO block_changelog (
                        bot_id, x, y, z, before_json, after_json, grant_id,
                        grant_fencing_token, claim_id, task_id, structure_id, blueprint_id,
                        blueprint_revision, work_package_id, plan_id, fencing_token, phase,
                        authorized, rejection_reason, created_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    change.botId,
                    change.position.x,
                    change.position.y,
                    change.position.z,
                    change.before === undefined ? null : JSON.stringify(change.before),
                    change.after === undefined ? null : JSON.stringify(change.after),
                    change.grantId ?? null,
                    change.grantFencingToken ?? null,
                    change.claimId ?? null,
                    change.taskId ?? null,
                    change.structureId ?? null,
                    change.blueprintId ?? null,
                    change.blueprintRevision ?? null,
                    change.workPackageId ?? null,
                    change.planId ?? null,
                    change.fencingToken ?? null,
                    change.phase ?? null,
                    change.authorized === false ? 0 : 1,
                    change.rejectionReason ?? null,
                    change.createdAt ?? new Date().toISOString(),
                );
            return Number(result.lastInsertRowid);
        });
        if (error) {
            return [null, StorageFailures.from('WRITE_FAILED', error)];
        }
        if (id === null) {
            return [null, StorageFailures.from('WRITE_FAILED', 'Block change id missing')];
        }

        return [id, null];
    }
}

import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { EditGrantCodec, type EditGrantRow } from './grant-codec.js';
import type { EditGrantRecord } from './types.js';

const columnList = `
    id, structure_id, owner_bot_id, grantee_bot_id, revision, status, expires_at,
    created_at, bbox_json, allowed_ops_json, material_constraints_json, intent,
    fencing_token, epoch, granted_by, task_id, updated_at
`;

interface TokenRow {
    token: number;
}

export class EditGrantRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    insert(record: EditGrantRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO edit_grants (
                        id, structure_id, owner_bot_id, grantee_bot_id, revision, status,
                        expires_at, created_at, bbox_json, allowed_ops_json,
                        material_constraints_json, intent, fencing_token, epoch,
                        granted_by, task_id, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    record.id,
                    record.structureId,
                    record.ownerBotId,
                    record.granteeBotId,
                    record.designRevision,
                    record.status,
                    record.expiresAt,
                    record.createdAt,
                    EditGrantCodec.encodeBbox(record),
                    EditGrantCodec.encodeAllowedOps(record),
                    EditGrantCodec.encodeMaterialConstraints(record),
                    record.intent,
                    record.fencingToken,
                    record.epoch,
                    record.grantedBy,
                    record.taskId,
                    record.updatedAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    update(record: EditGrantRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `UPDATE edit_grants SET
                        structure_id = ?, owner_bot_id = ?, grantee_bot_id = ?, revision = ?,
                        status = ?, expires_at = ?, bbox_json = ?, allowed_ops_json = ?,
                        material_constraints_json = ?, intent = ?, fencing_token = ?,
                        epoch = ?, granted_by = ?, task_id = ?, updated_at = ?
                     WHERE id = ?`,
                )
                .run(
                    record.structureId,
                    record.ownerBotId,
                    record.granteeBotId,
                    record.designRevision,
                    record.status,
                    record.expiresAt,
                    EditGrantCodec.encodeBbox(record),
                    EditGrantCodec.encodeAllowedOps(record),
                    EditGrantCodec.encodeMaterialConstraints(record),
                    record.intent,
                    record.fencingToken,
                    record.epoch,
                    record.grantedBy,
                    record.taskId,
                    record.updatedAt,
                    record.id,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(grantId: string): Result<EditGrantRecord | null, StorageFailure> {
        const [row, readError] = attempt<EditGrantRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${columnList} FROM edit_grants WHERE id = ?`)
                    .get(grantId) as EditGrantRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return EditGrantCodec.decode(row);
    }

    listActive(): Result<readonly EditGrantRecord[], StorageFailure> {
        return this.list(
            'SELECT ' +
                columnList +
                " FROM edit_grants WHERE status = 'active' ORDER BY created_at, id",
        );
    }

    listActiveForStructure(
        structureId: string,
    ): Result<readonly EditGrantRecord[], StorageFailure> {
        return this.list(
            'SELECT ' +
                columnList +
                " FROM edit_grants WHERE status = 'active' AND structure_id = ? ORDER BY created_at, id",
            structureId,
        );
    }

    listExpired(now: string): Result<readonly EditGrantRecord[], StorageFailure> {
        return this.list(
            'SELECT ' +
                columnList +
                " FROM edit_grants WHERE status = 'active' AND expires_at <= ? ORDER BY created_at, id",
            now,
        );
    }

    nextFencingToken(): Result<number, StorageFailure> {
        const [row, readError] = attempt<TokenRow, unknown>(
            () =>
                this.database
                    .prepare('SELECT COALESCE(MAX(fencing_token), 0) + 1 AS token FROM edit_grants')
                    .get() as TokenRow,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null) return [null, StorageFailures.from('READ_FAILED', 'token missing')];
        return [Number(row.token), null];
    }

    private list(
        sql: string,
        ...parameters: unknown[]
    ): Result<readonly EditGrantRecord[], StorageFailure> {
        const [rows, readError] = attempt<EditGrantRow[], unknown>(
            () => this.database.prepare(sql).all(...parameters) as EditGrantRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'grants missing')];
        const records: EditGrantRecord[] = [];
        for (const row of rows) {
            const [record, decodeError] = EditGrantCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (record !== null) records.push(record);
        }
        return [records, null];
    }
}

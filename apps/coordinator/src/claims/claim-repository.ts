import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { ClaimCodec, type ClaimRow } from './claim-codec.js';
import type { ClaimRecord, ClaimStatus } from './types.js';

const columnList = `
    id, resource, owner_bot_id, lease_expires_at, fencing_token, created_at,
    resource_type, bbox_json, status, task_id, parent_claim_id, epoch, payload_json, updated_at
`;

interface TokenRow {
    token: number;
}

export class ClaimRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    insert(record: ClaimRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO claims (
                        id, resource, owner_bot_id, lease_expires_at, fencing_token,
                        created_at, resource_type, bbox_json, status, task_id, parent_claim_id,
                        epoch, payload_json, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    record.id,
                    record.resourceId,
                    record.botId,
                    record.leaseUntil,
                    record.fencingToken,
                    record.createdAt,
                    record.resourceType,
                    ClaimCodec.encodeBbox(record.bbox),
                    record.status,
                    record.taskId,
                    record.parentClaimId,
                    record.epoch,
                    ClaimCodec.encodePayload(record.payload),
                    record.updatedAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    update(record: ClaimRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `UPDATE claims SET
                        resource = ?, owner_bot_id = ?, lease_expires_at = ?,
                        fencing_token = ?, resource_type = ?, bbox_json = ?, status = ?,
                        task_id = ?, parent_claim_id = ?, epoch = ?, payload_json = ?, updated_at = ?
                     WHERE id = ?`,
                )
                .run(
                    record.resourceId,
                    record.botId,
                    record.leaseUntil,
                    record.fencingToken,
                    record.resourceType,
                    ClaimCodec.encodeBbox(record.bbox),
                    record.status,
                    record.taskId,
                    record.parentClaimId,
                    record.epoch,
                    ClaimCodec.encodePayload(record.payload),
                    record.updatedAt,
                    record.id,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(claimId: string): Result<ClaimRecord | null, StorageFailure> {
        const [row, readError] = attempt<ClaimRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${columnList} FROM claims WHERE id = ?`)
                    .get(claimId) as ClaimRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return ClaimCodec.decode(row);
    }

    listAll(): Result<readonly ClaimRecord[], StorageFailure> {
        return this.list('SELECT ' + columnList + ' FROM claims ORDER BY created_at, id');
    }

    listActive(): Result<readonly ClaimRecord[], StorageFailure> {
        return this.list(
            'SELECT ' + columnList + " FROM claims WHERE status = 'active' ORDER BY created_at, id",
        );
    }

    listExpired(now: string): Result<readonly ClaimRecord[], StorageFailure> {
        return this.list(
            'SELECT ' +
                columnList +
                " FROM claims WHERE status = 'active' AND lease_expires_at < ? ORDER BY created_at, id",
            now,
        );
    }

    nextFencingToken(): Result<number, StorageFailure> {
        const [row, readError] = attempt<TokenRow, unknown>(
            () =>
                this.database
                    .prepare('SELECT COALESCE(MAX(fencing_token), 0) + 1 AS token FROM claims')
                    .get() as TokenRow,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null) return [null, StorageFailures.from('READ_FAILED', 'token missing')];
        return [Number(row.token), null];
    }

    private list(
        sql: string,
        ...parameters: unknown[]
    ): Result<readonly ClaimRecord[], StorageFailure> {
        const [rows, readError] = attempt<ClaimRow[], unknown>(
            () => this.database.prepare(sql).all(...parameters) as ClaimRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'claims missing')];
        const records: ClaimRecord[] = [];
        for (const row of rows) {
            const [record, decodeError] = ClaimCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (record !== null) records.push(record);
        }
        return [records, null];
    }
}

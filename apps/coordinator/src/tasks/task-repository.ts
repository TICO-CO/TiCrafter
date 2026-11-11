import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { TaskCodec, type TaskRow } from './task-codec.js';
import type { TaskRecord, TaskStatus } from './types.js';

const columnList = `
    id, parent_id, title, status, priority, retry_count, payload_json,
    dependencies_json, preconditions_json, required_role, target_json,
    claimed_by, lease_until, lease_token, available_at, failure_class,
    dead_letter_reason, created_at, updated_at, completed_at
`;

interface TokenRow {
    token: number;
}

export class TaskRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    insert(record: TaskRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO tasks (
                        id, parent_id, title, status, priority, retry_count, payload_json,
                        dependencies_json, preconditions_json, required_role, target_json,
                        claimed_by, lease_until, lease_token, available_at, failure_class,
                        dead_letter_reason, created_at, updated_at, completed_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    record.id,
                    record.parentId,
                    record.title,
                    record.status,
                    record.priority,
                    record.retryCount,
                    TaskCodec.encodePayload(record.payload),
                    TaskCodec.encodeDependencies(record.dependencies),
                    TaskCodec.encodePreconditions(record.preconditions),
                    record.requiredRole,
                    TaskCodec.encodeTarget(record.target),
                    record.claimedBy,
                    record.leaseUntil,
                    record.leaseToken,
                    record.availableAt,
                    record.failureClass,
                    record.deadLetterReason,
                    record.createdAt,
                    record.updatedAt,
                    record.completedAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    update(record: TaskRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `UPDATE tasks SET
                        parent_id = ?, title = ?, status = ?, priority = ?, retry_count = ?,
                        payload_json = ?, dependencies_json = ?, preconditions_json = ?,
                        required_role = ?, target_json = ?, claimed_by = ?, lease_until = ?,
                        lease_token = ?, available_at = ?, failure_class = ?,
                        dead_letter_reason = ?, updated_at = ?, completed_at = ?
                     WHERE id = ?`,
                )
                .run(
                    record.parentId,
                    record.title,
                    record.status,
                    record.priority,
                    record.retryCount,
                    TaskCodec.encodePayload(record.payload),
                    TaskCodec.encodeDependencies(record.dependencies),
                    TaskCodec.encodePreconditions(record.preconditions),
                    record.requiredRole,
                    TaskCodec.encodeTarget(record.target),
                    record.claimedBy,
                    record.leaseUntil,
                    record.leaseToken,
                    record.availableAt,
                    record.failureClass,
                    record.deadLetterReason,
                    record.updatedAt,
                    record.completedAt,
                    record.id,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(taskId: string): Result<TaskRecord | null, StorageFailure> {
        const [row, readError] = attempt<TaskRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${columnList} FROM tasks WHERE id = ?`)
                    .get(taskId) as TaskRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return TaskCodec.decode(row);
    }

    list(): Result<readonly TaskRecord[], StorageFailure> {
        const [rows, readError] = attempt<TaskRow[], unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${columnList} FROM tasks ORDER BY created_at, id`)
                    .all() as TaskRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'tasks missing')];
        const records: TaskRecord[] = [];
        for (const row of rows) {
            const [record, decodeError] = TaskCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (record !== null) records.push(record);
        }
        return [records, null];
    }

    listByStatus(status: TaskStatus): Result<readonly TaskRecord[], StorageFailure> {
        const [rows, readError] = attempt<TaskRow[], unknown>(
            () =>
                this.database
                    .prepare(
                        `SELECT ${columnList} FROM tasks WHERE status = ? ORDER BY priority DESC, created_at`,
                    )
                    .all(status) as TaskRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'tasks missing')];
        const records: TaskRecord[] = [];
        for (const row of rows) {
            const [record, decodeError] = TaskCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (record !== null) records.push(record);
        }
        return [records, null];
    }

    nextLeaseToken(): Result<number, StorageFailure> {
        const [row, readError] = attempt<TokenRow, unknown>(
            () =>
                this.database
                    .prepare('SELECT COALESCE(MAX(lease_token), 0) + 1 AS token FROM tasks')
                    .get() as TokenRow,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null) return [null, StorageFailures.from('READ_FAILED', 'token missing')];
        return [Number(row.token), null];
    }

    claim(
        taskId: string,
        botId: string,
        leaseUntil: string,
        leaseToken: number,
        now: string,
    ): Result<boolean, StorageFailure> {
        const [changes, writeError] = attempt<number, unknown>(() => {
            const result = this.database
                .prepare(
                    `UPDATE tasks SET
                        status = 'claimed', claimed_by = ?, lease_until = ?, lease_token = ?,
                        updated_at = ?
                     WHERE id = ? AND status = 'ready' AND claimed_by IS NULL`,
                )
                .run(botId, leaseUntil, leaseToken, now, taskId);
            return Number(result.changes);
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        if (changes === null) return [null, StorageFailures.from('WRITE_FAILED', 'claim missing')];
        return [changes > 0, null];
    }
}

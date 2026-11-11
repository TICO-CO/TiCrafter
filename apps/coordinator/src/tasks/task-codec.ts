import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type {
    TaskFailureClass,
    TaskPrecondition,
    TaskRecord,
    TaskRole,
    TaskStatus,
} from './types.js';

export interface TaskRow {
    id: string;
    parent_id: string | null;
    title: string;
    status: string;
    priority: number;
    retry_count: number;
    payload_json: string;
    dependencies_json: string;
    preconditions_json: string;
    required_role: string | null;
    target_json: string | null;
    claimed_by: string | null;
    lease_until: string | null;
    lease_token: number | null;
    available_at: string;
    failure_class: string | null;
    dead_letter_reason: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

const taskStatuses = new Set<TaskStatus>([
    'pending',
    'ready',
    'claimed',
    'running',
    'completed',
    'failed',
    'dead_letter',
    'cancelled',
]);

const failureClasses = new Set<TaskFailureClass>([
    'transient',
    'precondition',
    'blocked',
    'invalid',
    'fatal',
]);

const taskRoles = new Set<TaskRole>(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard']);

export class TaskCodec {
    static encodePayload(payload: Readonly<Record<string, unknown>>): string {
        return JSON.stringify(payload);
    }

    static encodeDependencies(dependencies: readonly string[]): string {
        return JSON.stringify(dependencies);
    }

    static encodePreconditions(preconditions: readonly TaskPrecondition[]): string {
        return JSON.stringify(preconditions);
    }

    static encodeTarget(target: TaskRecord['target']): string | null {
        return target === null ? null : JSON.stringify(target);
    }

    static decode(row: TaskRow): Result<TaskRecord, StorageFailure> {
        const status = row.status as TaskStatus;
        if (!taskStatuses.has(status)) {
            return [null, this.failure(`unknown task status: ${row.status}`)];
        }
        const failureClass = row.failure_class as TaskFailureClass | null;
        if (failureClass !== null && !failureClasses.has(failureClass)) {
            return [null, this.failure(`unknown task failure class: ${row.failure_class}`)];
        }
        const requiredRole = row.required_role as TaskRole | null;
        if (requiredRole !== null && !taskRoles.has(requiredRole)) {
            return [null, this.failure(`unknown task role: ${row.required_role}`)];
        }
        const [record, decodeError] = attempt<TaskRecord, unknown>(() => ({
            id: row.id,
            parentId: row.parent_id,
            title: row.title,
            status,
            priority: row.priority,
            retryCount: row.retry_count,
            payload: JSON.parse(row.payload_json) as Readonly<Record<string, unknown>>,
            dependencies: JSON.parse(row.dependencies_json) as string[],
            preconditions: JSON.parse(row.preconditions_json) as TaskPrecondition[],
            requiredRole,
            target: row.target_json === null ? null : JSON.parse(row.target_json),
            claimedBy: row.claimed_by,
            leaseUntil: row.lease_until,
            leaseToken: row.lease_token,
            availableAt: row.available_at,
            failureClass,
            deadLetterReason: row.dead_letter_reason,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at,
        }));
        if (decodeError) return [null, this.failure(decodeError)];
        if (record === null) return [null, this.failure('task missing')];
        return [record, null];
    }

    private static failure(error: unknown): StorageFailure {
        return StorageFailures.from('READ_FAILED', error);
    }
}

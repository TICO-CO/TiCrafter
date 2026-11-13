import type { LoggerPort, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { TaskFailure, TaskRecord } from '../tasks/index.js';
import {
    TaskIndependenceAuditor,
    type TaskIndependenceAuditPort,
} from './task-independence-auditor.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function task(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
    return {
        id,
        parentId: null,
        title: id,
        status: 'ready',
        priority: 1,
        retryCount: 0,
        payload: {},
        dependencies: [],
        preconditions: [],
        requiredRole: null,
        target: null,
        claimedBy: null,
        leaseUntil: null,
        leaseToken: null,
        availableAt: '2026-11-11T12:00:00.000Z',
        failureClass: null,
        deadLetterReason: null,
        createdAt: '2026-11-11T12:00:00.000Z',
        updatedAt: '2026-11-11T12:00:00.000Z',
        completedAt: null,
        ...overrides,
    };
}

class FakeTasks implements TaskIndependenceAuditPort {
    readonly cancelled: string[] = [];

    constructor(private readonly records: readonly TaskRecord[]) {}

    list(): Result<readonly TaskRecord[], TaskFailure> {
        return [this.records, null];
    }

    cancel(taskId: string): Result<TaskRecord, TaskFailure> {
        const record = this.records.find((candidate) => candidate.id === taskId);
        if (record === undefined) return [null, { type: 'TASK_NOT_FOUND', taskId }];
        this.cancelled.push(taskId);
        return [{ ...record, status: 'cancelled' }, null];
    }
}

describe('TaskIndependenceAuditor', () => {
    it('cancels open tasks with parents or dependencies', () => {
        const tasks = new FakeTasks([
            task('task-independent'),
            task('task-parented', { parentId: 'task-independent' }),
            task('task-dependent', { dependencies: ['task-independent'] }),
            task('task-completed', {
                status: 'completed',
                dependencies: ['task-independent'],
            }),
            task('task-project', {
                payload: { projectId: 'project-1' },
                dependencies: ['task-independent'],
            }),
        ]);
        const auditor = new TaskIndependenceAuditor({ tasks, logger });
        const [cancelled, auditError] = auditor.audit();

        expect(auditError).toBeNull();
        expect(cancelled).toEqual(['task-parented', 'task-dependent']);
        expect(tasks.cancelled).toEqual(['task-parented', 'task-dependent']);
    });
});

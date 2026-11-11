import type { LoggerPort, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { TaskLeaseReaper, type TaskLeaseReaperPort } from './task-lease-reaper.js';
import type { TaskFailure, TaskRecord } from './types.js';

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
        status: 'claimed',
        priority: 1,
        retryCount: 0,
        payload: {},
        dependencies: [],
        preconditions: [],
        requiredRole: null,
        target: null,
        claimedBy: 'bot.one',
        leaseUntil: '2026-11-11T12:00:00.000Z',
        leaseToken: 1,
        availableAt: '2026-11-11T12:00:00.000Z',
        failureClass: null,
        deadLetterReason: null,
        createdAt: '2026-11-11T12:00:00.000Z',
        updatedAt: '2026-11-11T12:00:00.000Z',
        completedAt: null,
        ...overrides,
    };
}

class FakeTasks implements TaskLeaseReaperPort {
    readonly requeued: string[] = [];

    constructor(private readonly records: readonly TaskRecord[]) {}

    list(): Result<readonly TaskRecord[], TaskFailure> {
        return [this.records, null];
    }

    requeue(taskId: string): Result<TaskRecord, TaskFailure> {
        const record = this.records.find((candidate) => candidate.id === taskId);
        if (record === undefined) return [null, { type: 'TASK_NOT_FOUND', taskId }];
        this.requeued.push(taskId);
        return [{ ...record, status: 'ready', claimedBy: null, leaseUntil: null }, null];
    }
}

describe('TaskLeaseReaper', () => {
    it('requeues claimed and running tasks with expired leases', () => {
        const tasks = new FakeTasks([
            task('task-claimed'),
            task('task-running', { status: 'running' }),
            task('task-active', { leaseUntil: '2026-11-11T13:00:00.000Z' }),
            task('task-null-lease', { leaseUntil: null }),
            task('task-completed', { status: 'completed' }),
        ]);
        const reaper = new TaskLeaseReaper({
            tasks,
            logger,
            now: () => '2026-11-11T12:30:00.000Z',
        });

        const [requeued, reapError] = reaper.reap();

        expect(reapError).toBeNull();
        expect(requeued).toEqual(['task-claimed', 'task-running']);
        expect(tasks.requeued).toEqual(['task-claimed', 'task-running']);
    });
});

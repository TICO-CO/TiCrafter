import type { LoggerPort, Result } from '@ticrafter/core';

import type { TaskFailure, TaskRecord } from './types.js';

export interface TaskLeaseReaperPort {
    list(): Result<readonly TaskRecord[], TaskFailure>;
    requeue(
        taskId: string,
        actor: string,
        reason: string,
        now?: string,
    ): Result<TaskRecord, TaskFailure>;
}

export interface TaskLeaseReaperOptions {
    tasks: TaskLeaseReaperPort;
    logger: LoggerPort;
    now?: () => string;
}

export class TaskLeaseReaper {
    constructor(private readonly options: TaskLeaseReaperOptions) {}

    reap(): Result<readonly string[], string> {
        const [tasks, listError] = this.options.tasks.list();
        if (listError) return [null, TaskLeaseReaper.describe(listError)];
        if (tasks === null) return [null, 'task list missing'];

        const now = this.options.now?.() ?? new Date().toISOString();
        const nowMilliseconds = Date.parse(now);
        if (!Number.isFinite(nowMilliseconds)) return [null, `invalid reaper time ${now}`];

        const requeued: string[] = [];
        for (const task of tasks) {
            if (task.status !== 'claimed' && task.status !== 'running') continue;
            if (task.leaseUntil === null) continue;
            const leaseMilliseconds = Date.parse(task.leaseUntil);
            if (!Number.isFinite(leaseMilliseconds) || leaseMilliseconds >= nowMilliseconds) {
                continue;
            }
            const [, requeueError] = this.options.tasks.requeue(
                task.id,
                'lease-reaper',
                'task lease expired',
                now,
            );
            if (requeueError !== null && requeueError.type !== 'INVALID_TRANSITION') {
                return [null, TaskLeaseReaper.describe(requeueError)];
            }
            if (requeueError === null) requeued.push(task.id);
        }
        if (requeued.length > 0) {
            this.options.logger.info({ requeued }, 'expired task leases requeued');
        }
        return [requeued, null];
    }

    private static describe(failure: TaskFailure): string {
        switch (failure.type) {
            case 'STORAGE':
                return `${failure.failure.type}: ${failure.failure.message}`;
            case 'INVALID_TASK':
            case 'MALFORMED_TASK':
                return failure.message;
            case 'DUPLICATE_TASK':
            case 'TASK_NOT_FOUND':
            case 'INVALID_TRANSITION':
            case 'PRECONDITION_FAILED':
            case 'CLAIM_CONFLICT':
            case 'DEPENDENCY_CYCLE':
                return failure.type;
        }
    }
}

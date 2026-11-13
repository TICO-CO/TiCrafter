import type { LoggerPort, Result } from '@ticrafter/core';

import type { TaskFailure, TaskRecord } from '../tasks/index.js';

const OPEN_TASK_STATUSES = new Set(['pending', 'ready', 'claimed', 'running']);

export interface TaskIndependenceAuditPort {
    list(): Result<readonly TaskRecord[], TaskFailure>;
    cancel(
        taskId: string,
        actor: string,
        reason: string,
        now?: string,
    ): Result<TaskRecord, TaskFailure>;
}

export interface TaskIndependenceAuditorOptions {
    tasks: TaskIndependenceAuditPort;
    logger: LoggerPort;
    now?: () => string;
}

export class TaskIndependenceAuditor {
    constructor(private readonly options: TaskIndependenceAuditorOptions) {}

    audit(): Result<readonly string[], string> {
        const [tasks, listError] = this.options.tasks.list();
        if (listError) return [null, TaskIndependenceAuditor.describe(listError)];
        if (tasks === null) return [null, 'task list missing'];

        const now = this.options.now?.() ?? new Date().toISOString();
        const cancelled: string[] = [];
        for (const task of tasks) {
            if (!OPEN_TASK_STATUSES.has(task.status)) continue;
            if (TaskIndependenceAuditor.projectTask(task)) continue;
            if (task.parentId === null && task.dependencies.length === 0) continue;
            const [, cancelError] = this.options.tasks.cancel(
                task.id,
                'planner',
                'task violates independence policy',
                now,
            );
            if (cancelError !== null && cancelError.type !== 'INVALID_TRANSITION') {
                return [null, TaskIndependenceAuditor.describe(cancelError)];
            }
            if (cancelError === null) cancelled.push(task.id);
        }
        if (cancelled.length > 0) {
            this.options.logger.info({ cancelled }, 'cancelled non-independent tasks');
        }
        return [cancelled, null];
    }

    private static projectTask(task: TaskRecord): boolean {
        const projectId = task.payload.projectId;
        return typeof projectId === 'string' && projectId.length > 0;
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

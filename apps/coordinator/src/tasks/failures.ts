import type { StorageFailure } from '@ticrafter/memory';

import type { TaskFailure, TaskPreconditionFailure, TaskStatus } from './types.js';

export class TaskFailures {
    static storage(failure: StorageFailure): TaskFailure {
        return { type: 'STORAGE', failure };
    }

    static duplicateTask(taskId: string): TaskFailure {
        return { type: 'DUPLICATE_TASK', taskId };
    }

    static taskNotFound(taskId: string): TaskFailure {
        return { type: 'TASK_NOT_FOUND', taskId };
    }

    static invalidTask(message: string): TaskFailure {
        return { type: 'INVALID_TASK', message };
    }

    static malformedTask(message: string): TaskFailure {
        return { type: 'MALFORMED_TASK', message };
    }

    static dependencyCycle(taskIds: readonly string[]): TaskFailure {
        return { type: 'DEPENDENCY_CYCLE', taskIds };
    }

    static invalidTransition(taskId: string, from: TaskStatus, to: TaskStatus): TaskFailure {
        return { type: 'INVALID_TRANSITION', taskId, from, to };
    }

    static preconditionFailed(
        taskId: string,
        failures: readonly TaskPreconditionFailure[],
    ): TaskFailure {
        return { type: 'PRECONDITION_FAILED', taskId, failures };
    }

    static claimConflict(taskId: string): TaskFailure {
        return { type: 'CLAIM_CONFLICT', taskId };
    }
}

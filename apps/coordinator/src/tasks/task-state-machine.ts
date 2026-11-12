import type { Result } from '@ticrafter/core';
import type { EventLogWriter, StorageFailure } from '@ticrafter/memory';

import { TaskFailures } from './failures.js';
import type { TaskRepository } from './task-repository.js';
import type { TaskFailure, TaskFailureClass, TaskRecord, TaskStatus } from './types.js';

export interface TaskTransitionChanges {
    claimedBy?: string | null;
    leaseUntil?: string | null;
    leaseToken?: number | null;
    availableAt?: string;
    retryCount?: number;
    failureClass?: TaskFailureClass | null;
    deadLetterReason?: string | null;
    completedAt?: string | null;
}

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
    pending: ['ready', 'cancelled'],
    ready: ['claimed', 'cancelled'],
    claimed: ['running', 'completed', 'failed', 'ready', 'cancelled'],
    running: ['completed', 'failed', 'ready', 'cancelled'],
    completed: [],
    failed: ['ready', 'dead_letter', 'cancelled'],
    dead_letter: ['pending', 'cancelled'],
    cancelled: [],
};

export class TaskStateMachine {
    constructor(
        private readonly repository: TaskRepository,
        private readonly events: EventLogWriter,
    ) {}

    static canTransition(from: TaskStatus, to: TaskStatus): boolean {
        return transitions[from].includes(to);
    }

    transition(
        task: TaskRecord,
        nextStatus: TaskStatus,
        actor: string,
        reason: string,
        now: string,
        changes: TaskTransitionChanges = {},
    ): Result<TaskRecord, TaskFailure> {
        if (!TaskStateMachine.canTransition(task.status, nextStatus)) {
            return [null, TaskFailures.invalidTransition(task.id, task.status, nextStatus)];
        }
        const completedAt =
            nextStatus === 'completed' ? (changes.completedAt ?? now) : task.completedAt;
        const updated: TaskRecord = {
            ...task,
            ...changes,
            status: nextStatus,
            updatedAt: now,
            completedAt,
        };
        const [, updateError] = this.repository.update(updated);
        if (updateError) return [null, TaskFailures.storage(updateError)];
        const eventBotId = changes.claimedBy === undefined ? task.claimedBy : changes.claimedBy;
        const [, eventError] = this.events.append({
            botId: eventBotId ?? undefined,
            type: 'task.transition',
            payload: {
                taskId: task.id,
                from: task.status,
                to: nextStatus,
                actor,
                reason,
            },
            actor,
            createdAt: now,
        });
        if (eventError) return [null, this.storageFailure(eventError)];
        return [updated, null];
    }

    private storageFailure(failure: StorageFailure): TaskFailure {
        return TaskFailures.storage(failure);
    }
}

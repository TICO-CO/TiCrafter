import type { Result } from '@ticrafter/core';

import type { TaskStateMachine } from './task-state-machine.js';
import type { TaskFailure, TaskRecord } from './types.js';

export class TaskDeadLetterManager {
    constructor(private readonly stateMachine: TaskStateMachine) {}

    park(
        task: TaskRecord,
        reason: string,
        actor: string,
        now: string,
    ): Result<TaskRecord, TaskFailure> {
        return this.stateMachine.transition(task, 'dead_letter', actor, reason, now, {
            claimedBy: null,
            leaseUntil: null,
            leaseToken: null,
            deadLetterReason: reason,
        });
    }
}

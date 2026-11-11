import type { TaskFailureClass, TaskRecord, TaskRetryDecision } from './types.js';

interface RetryPolicy {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

const policies: Record<TaskFailureClass, RetryPolicy> = {
    transient: { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 30_000 },
    precondition: { maxRetries: 2, baseDelayMs: 2_000, maxDelayMs: 30_000 },
    blocked: { maxRetries: 2, baseDelayMs: 5_000, maxDelayMs: 60_000 },
    invalid: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
    fatal: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
};

export class TaskRetryManager {
    static decide(
        task: TaskRecord,
        failureClass: TaskFailureClass,
        now: string,
    ): TaskRetryDecision {
        const policy = policies[failureClass];
        if (task.retryCount >= policy.maxRetries) {
            return {
                action: 'dead-letter',
                reason: `retry budget exhausted after ${task.retryCount} attempts`,
            };
        }
        const delay = Math.min(policy.baseDelayMs * 2 ** task.retryCount, policy.maxDelayMs);
        return {
            action: 'retry',
            readyAt: new Date(Date.parse(now) + delay).toISOString(),
            retryCount: task.retryCount + 1,
        };
    }
}

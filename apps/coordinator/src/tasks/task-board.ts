import type { Result } from '@ticrafter/core';
import { type EventLogWriter, StorageFailures, type TransactionManager } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { AtomicTaskClaimer } from './atomic-task-claimer.js';
import { TaskDagResolver } from './dag-resolver.js';
import { TaskDeadLetterManager } from './dead-letter-manager.js';
import { TaskPreconditionEvaluator } from './precondition-evaluator.js';
import { TaskRetryManager } from './retry-manager.js';
import { TaskRepository } from './task-repository.js';
import { TaskStateMachine } from './task-state-machine.js';
import type {
    CreateTaskInput,
    TaskClaimContext,
    TaskClaimPort,
    TaskFailure,
    TaskFailureClass,
    TaskLease,
    TaskRecord,
    TaskStatus,
    TaskWorldPort,
} from './types.js';

export interface TaskBoardOptions {
    database: CoordinatorDatabase;
    events: EventLogWriter;
    transactions: TransactionManager;
    world: TaskWorldPort;
    claims: TaskClaimPort;
}

export class TaskBoard {
    private readonly repository: TaskRepository;
    private readonly stateMachine: TaskStateMachine;
    private readonly claimer: AtomicTaskClaimer;
    private readonly deadLetters: TaskDeadLetterManager;

    constructor(private readonly options: TaskBoardOptions) {
        this.repository = new TaskRepository(options.database);
        this.stateMachine = new TaskStateMachine(this.repository, options.events);
        this.deadLetters = new TaskDeadLetterManager(this.stateMachine);
        this.claimer = new AtomicTaskClaimer(
            this.repository,
            new TaskPreconditionEvaluator(),
            this.stateMachine,
            options.events,
            options.transactions,
        );
    }

    create(
        input: CreateTaskInput,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        return this.run(() => {
            const validation = TaskBoard.validate(input);
            if (validation !== null) return [null, validation];
            const [existing, existingError] = this.repository.get(input.id);
            if (existingError) return [null, { type: 'STORAGE', failure: existingError }];
            if (existing !== null) return [null, { type: 'DUPLICATE_TASK', taskId: input.id }];
            const record: TaskRecord = {
                id: input.id,
                parentId: input.parentId ?? null,
                title: input.title,
                status: 'pending',
                priority: input.priority ?? 0,
                retryCount: 0,
                payload: input.payload ?? {},
                dependencies: input.dependencies ?? [],
                preconditions: input.preconditions ?? [],
                requiredRole: input.requiredRole ?? null,
                target: input.target ?? null,
                claimedBy: null,
                leaseUntil: null,
                leaseToken: null,
                availableAt: now,
                failureClass: null,
                deadLetterReason: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            };
            const [tasks, listError] = this.repository.list();
            if (listError) return [null, { type: 'STORAGE', failure: listError }];
            if (tasks === null) {
                return [null, { type: 'MALFORMED_TASK', message: 'task list missing' }];
            }
            const [, dagError] = TaskDagResolver.build([...tasks, record]);
            if (dagError) return [null, dagError];
            const [, insertError] = this.repository.insert(record);
            if (insertError) return [null, { type: 'STORAGE', failure: insertError }];
            const [, eventError] = this.options.events.append({
                type: 'task.created',
                payload: { taskId: record.id, title: record.title, actor: 'coordinator' },
                actor: 'coordinator',
                createdAt: now,
            });
            if (eventError) return [null, { type: 'STORAGE', failure: eventError }];
            return [record, null];
        });
    }

    list(): Result<readonly TaskRecord[], TaskFailure> {
        const [tasks, listError] = this.repository.list();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        return [tasks, null];
    }

    get(taskId: string): Result<TaskRecord | null, TaskFailure> {
        const [task, readError] = this.repository.get(taskId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        return [task, null];
    }

    claimNext(
        context: Omit<TaskClaimContext, 'world' | 'claims'>,
        now = new Date().toISOString(),
    ): Result<TaskLease | null, TaskFailure> {
        return this.claimer.claimNext(
            { ...context, world: this.options.world, claims: this.options.claims },
            now,
        );
    }

    renew(
        taskId: string,
        botId: string,
        fencingToken: number,
        leaseTtlMilliseconds = 30_000,
        now = new Date().toISOString(),
    ): Result<boolean, TaskFailure> {
        const leaseUntil = new Date(Date.parse(now) + leaseTtlMilliseconds).toISOString();
        const [renewed, renewError] = this.repository.renew(
            taskId,
            botId,
            leaseUntil,
            fencingToken,
            now,
        );
        if (renewError) return [null, { type: 'STORAGE', failure: renewError }];
        return [renewed, null];
    }

    verifyLease(
        taskId: string,
        botId: string,
        fencingToken: number,
    ): Result<TaskRecord, TaskFailure> {
        const [task, readError] = this.repository.get(taskId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (task === null) return [null, { type: 'TASK_NOT_FOUND', taskId }];
        if (
            task.claimedBy !== botId ||
            task.leaseToken !== fencingToken ||
            (task.status !== 'claimed' && task.status !== 'running')
        ) {
            return [null, { type: 'CLAIM_CONFLICT', taskId }];
        }
        return [task, null];
    }

    start(
        taskId: string,
        actor: string,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        return this.transition(taskId, 'running', actor, 'skill started', now);
    }

    complete(
        taskId: string,
        actor: string,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        return this.transition(taskId, 'completed', actor, 'task completed', now, {
            claimedBy: null,
            leaseUntil: null,
            leaseToken: null,
        });
    }

    fail(
        taskId: string,
        failureClass: TaskFailureClass,
        reason: string,
        actor: string,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        return this.run(() => {
            const [task, readError] = this.repository.get(taskId);
            if (readError) return [null, { type: 'STORAGE', failure: readError }];
            if (task === null) return [null, { type: 'TASK_NOT_FOUND', taskId }];
            const [failed, failError] =
                task.status === 'failed'
                    ? [task, null]
                    : this.stateMachine.transition(task, 'failed', actor, reason, now, {
                          failureClass,
                          deadLetterReason: null,
                      });
            if (failError) return [null, failError];
            if (failed === null) {
                return [null, { type: 'MALFORMED_TASK', message: 'failed task missing' }];
            }
            const decision = TaskRetryManager.decide(failed, failureClass, now);
            if (decision.action === 'dead-letter') {
                return this.deadLetters.park(failed, decision.reason, actor, now);
            }
            return this.stateMachine.transition(failed, 'ready', actor, 'retry scheduled', now, {
                retryCount: decision.retryCount,
                availableAt: decision.readyAt,
                failureClass,
                claimedBy: null,
                leaseUntil: null,
                leaseToken: null,
            });
        });
    }

    requeue(
        taskId: string,
        actor: string,
        reason: string,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        return this.run(() => {
            const [task, readError] = this.repository.get(taskId);
            if (readError) return [null, { type: 'STORAGE', failure: readError }];
            if (task === null) return [null, { type: 'TASK_NOT_FOUND', taskId }];
            if (
                task.status !== 'claimed' &&
                task.status !== 'running' &&
                task.status !== 'failed'
            ) {
                return [task, null];
            }
            return this.stateMachine.transition(task, 'ready', actor, reason, now, {
                claimedBy: null,
                leaseUntil: null,
                leaseToken: null,
                availableAt: now,
            });
        });
    }

    transition(
        taskId: string,
        status: TaskStatus,
        actor: string,
        reason: string,
        now = new Date().toISOString(),
        changes: Parameters<TaskStateMachine['transition']>[5] = {},
    ): Result<TaskRecord, TaskFailure> {
        return this.run(() => {
            const [task, readError] = this.repository.get(taskId);
            if (readError) return [null, { type: 'STORAGE', failure: readError }];
            if (task === null) return [null, { type: 'TASK_NOT_FOUND', taskId }];
            return this.stateMachine.transition(task, status, actor, reason, now, changes);
        });
    }

    private run<T>(operation: () => Result<T, TaskFailure>): Result<T, TaskFailure> {
        const [result, transactionError] =
            this.options.transactions.run<Result<T, TaskFailure>>(operation);
        if (transactionError) return [null, { type: 'STORAGE', failure: transactionError }];
        if (result === null) {
            return [
                null,
                {
                    type: 'STORAGE',
                    failure: StorageFailures.from(
                        'TRANSACTION_FAILED',
                        'transaction returned null',
                    ),
                },
            ];
        }
        return result;
    }

    private static validate(input: CreateTaskInput): TaskFailure | null {
        if (input.id.trim().length === 0) {
            return { type: 'INVALID_TASK', message: 'task id is required' };
        }
        if (input.title.trim().length === 0) {
            return { type: 'INVALID_TASK', message: 'task title is required' };
        }
        if (new Set(input.dependencies ?? []).size !== (input.dependencies ?? []).length) {
            return { type: 'INVALID_TASK', message: 'task dependencies must be unique' };
        }
        if ((input.dependencies ?? []).includes(input.id)) {
            return { type: 'INVALID_TASK', message: 'task cannot depend on itself' };
        }
        return null;
    }
}

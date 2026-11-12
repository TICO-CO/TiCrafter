import type { Result } from '@ticrafter/core';
import { type EventLogWriter, StorageFailures, type TransactionManager } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { AtomicTaskClaimer } from './atomic-task-claimer.js';
import { TaskDagResolver } from './dag-resolver.js';
import { TaskDeadLetterManager } from './dead-letter-manager.js';
import { TaskFailures } from './failures.js';
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
            if (existingError) return [null, TaskFailures.storage(existingError)];
            if (existing !== null) return [null, TaskFailures.duplicateTask(input.id)];
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
            if (listError) return [null, TaskFailures.storage(listError)];
            if (tasks === null) {
                return [null, TaskFailures.malformedTask('task list missing')];
            }
            const [, dagError] = TaskDagResolver.build([...tasks, record]);
            if (dagError) return [null, dagError];
            const [, insertError] = this.repository.insert(record);
            if (insertError) return [null, TaskFailures.storage(insertError)];
            const [, eventError] = this.options.events.append({
                type: 'task.created',
                payload: { taskId: record.id, title: record.title, actor: 'coordinator' },
                actor: 'coordinator',
                createdAt: now,
            });
            if (eventError) return [null, TaskFailures.storage(eventError)];
            return [record, null];
        });
    }

    list(): Result<readonly TaskRecord[], TaskFailure> {
        const [tasks, listError] = this.repository.list();
        if (listError) return [null, TaskFailures.storage(listError)];
        return [tasks, null];
    }

    get(taskId: string): Result<TaskRecord | null, TaskFailure> {
        const [task, readError] = this.repository.get(taskId);
        if (readError) return [null, TaskFailures.storage(readError)];
        return [task, null];
    }

    activeTaskCount(botId: string): Result<number, TaskFailure> {
        const [tasks, listError] = this.list();
        if (listError) return [null, listError];
        if (tasks === null) {
            return [null, TaskFailures.malformedTask('task list missing')];
        }
        return [
            tasks.filter(
                (task) =>
                    task.claimedBy === botId &&
                    (task.status === 'claimed' || task.status === 'running'),
            ).length,
            null,
        ];
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

    offers(
        context: Omit<TaskClaimContext, 'world' | 'claims'>,
        now = new Date().toISOString(),
    ): Result<readonly TaskRecord[], TaskFailure> {
        return this.claimer.offerableTasks(
            { ...context, world: this.options.world, claims: this.options.claims },
            now,
        );
    }

    claimOffered(
        taskId: string,
        context: Omit<TaskClaimContext, 'world' | 'claims'>,
        now = new Date().toISOString(),
    ): Result<TaskLease | null, TaskFailure> {
        return this.claimer.claimTask(
            taskId,
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
        if (renewError) return [null, TaskFailures.storage(renewError)];
        return [renewed, null];
    }

    verifyLease(
        taskId: string,
        botId: string,
        fencingToken: number,
    ): Result<TaskRecord, TaskFailure> {
        const [task, readError] = this.repository.get(taskId);
        if (readError) return [null, TaskFailures.storage(readError)];
        if (task === null) return [null, TaskFailures.taskNotFound(taskId)];
        if (
            task.claimedBy !== botId ||
            task.leaseToken !== fencingToken ||
            (task.status !== 'claimed' && task.status !== 'running')
        ) {
            return [null, TaskFailures.claimConflict(taskId)];
        }
        return [task, null];
    }

    withPayload(
        taskId: string,
        payload: Readonly<Record<string, unknown>>,
        actor: string,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        const [task, readError] = this.repository.get(taskId);
        if (readError) return [null, TaskFailures.storage(readError)];
        if (task === null) return [null, TaskFailures.taskNotFound(taskId)];
        const updated: TaskRecord = { ...task, payload, updatedAt: now };
        const [, updateError] = this.repository.update(updated);
        if (updateError) return [null, TaskFailures.storage(updateError)];
        const [, eventError] = this.options.events.append({
            type: 'task.payload.updated',
            payload: { taskId, actor },
            actor,
            createdAt: now,
        });
        if (eventError) return [null, TaskFailures.storage(eventError)];
        return [updated, null];
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

    cancel(
        taskId: string,
        actor: string,
        reason: string,
        now = new Date().toISOString(),
    ): Result<TaskRecord, TaskFailure> {
        return this.transition(taskId, 'cancelled', actor, reason, now, {
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
            if (readError) return [null, TaskFailures.storage(readError)];
            if (task === null) return [null, TaskFailures.taskNotFound(taskId)];
            const [failed, failError] =
                task.status === 'failed'
                    ? [task, null]
                    : this.stateMachine.transition(task, 'failed', actor, reason, now, {
                          failureClass,
                          deadLetterReason: null,
                      });
            if (failError) return [null, failError];
            if (failed === null) {
                return [null, TaskFailures.malformedTask('failed task missing')];
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
            if (readError) return [null, TaskFailures.storage(readError)];
            if (task === null) return [null, TaskFailures.taskNotFound(taskId)];
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
            if (readError) return [null, TaskFailures.storage(readError)];
            if (task === null) return [null, TaskFailures.taskNotFound(taskId)];
            return this.stateMachine.transition(task, status, actor, reason, now, changes);
        });
    }

    private run<T>(operation: () => Result<T, TaskFailure>): Result<T, TaskFailure> {
        const [result, transactionError] =
            this.options.transactions.run<Result<T, TaskFailure>>(operation);
        if (transactionError) return [null, TaskFailures.storage(transactionError)];
        if (result === null) {
            return [
                null,
                TaskFailures.storage(
                    StorageFailures.from('TRANSACTION_FAILED', 'transaction returned null'),
                ),
            ];
        }
        return result;
    }

    private static validate(input: CreateTaskInput): TaskFailure | null {
        if (input.id.trim().length === 0) {
            return TaskFailures.invalidTask('task id is required');
        }
        if (input.title.trim().length === 0) {
            return TaskFailures.invalidTask('task title is required');
        }
        if (new Set(input.dependencies ?? []).size !== (input.dependencies ?? []).length) {
            return TaskFailures.invalidTask('task dependencies must be unique');
        }
        if ((input.dependencies ?? []).includes(input.id)) {
            return TaskFailures.invalidTask('task cannot depend on itself');
        }
        if (input.payload?.skillId === 'construction') {
            const validationError = TaskBoard.validateConstruction(input.payload);
            if (validationError !== null) return validationError;
        }
        return null;
    }

    private static validateConstruction(
        payload: Readonly<Record<string, unknown>>,
    ): TaskFailure | null {
        const requiredStrings = ['structureId', 'blueprintId', 'planId', 'workPackageId'] as const;
        const missing = requiredStrings.find(
            (key) => typeof payload[key] !== 'string' || payload[key].length === 0,
        );
        if (missing !== undefined) {
            return TaskFailures.invalidTask(`construction task requires ${missing}`);
        }
        const requiredNumbers = ['blueprintRevision', 'planRevision'] as const;
        const invalid = requiredNumbers.find(
            (key) => typeof payload[key] !== 'number' || !Number.isInteger(payload[key]),
        );
        if (invalid !== undefined) {
            return TaskFailures.invalidTask(`construction task requires integer ${invalid}`);
        }
        return null;
    }
}

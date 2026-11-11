import type { Result } from '@ticrafter/core';
import type { EventLogWriter, TransactionManager } from '@ticrafter/memory';

import { type TaskDag, TaskDagResolver } from './dag-resolver.js';
import type { TaskPreconditionEvaluator } from './precondition-evaluator.js';
import { TaskPriorityScheduler } from './priority-scheduler.js';
import type { TaskRepository } from './task-repository.js';
import type { TaskStateMachine } from './task-state-machine.js';
import type { TaskClaimContext, TaskFailure, TaskLease, TaskRecord } from './types.js';

export class AtomicTaskClaimer {
    constructor(
        private readonly repository: TaskRepository,
        private readonly evaluator: TaskPreconditionEvaluator,
        private readonly stateMachine: TaskStateMachine,
        private readonly events: EventLogWriter,
        private readonly transactions: TransactionManager,
        private readonly leaseTtlMilliseconds = 30_000,
    ) {}

    claimNext(
        context: TaskClaimContext,
        now = new Date().toISOString(),
    ): Result<TaskLease | null, TaskFailure> {
        const [result, transactionError] = this.transactions.run<
            Result<TaskLease | null, TaskFailure>
        >(() => this.claimInside(context, now));
        if (transactionError) return [null, { type: 'STORAGE', failure: transactionError }];
        if (result === null) {
            return [null, { type: 'CLAIM_CONFLICT', taskId: 'unknown' }];
        }
        const [lease, claimError] = result;
        if (claimError) return [null, claimError];
        return [lease, null];
    }

    private claimInside(
        context: TaskClaimContext,
        now: string,
    ): Result<TaskLease | null, TaskFailure> {
        if (context.activeTaskCount > 0) return [null, null];
        const [tasks, listError] = this.repository.list();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (tasks === null) return [null, { type: 'MALFORMED_TASK', message: 'task list missing' }];
        const [dag, dagError] = TaskDagResolver.build(tasks);
        if (dagError) return [null, dagError];
        if (dag === null) return [null, { type: 'MALFORMED_TASK', message: 'task DAG missing' }];
        const [promoted, promoteError] = this.promoteReady(tasks, dag, context.botId, now);
        if (promoteError) return [null, promoteError];
        if (promoted === null) {
            return [null, { type: 'MALFORMED_TASK', message: 'promoted tasks missing' }];
        }
        const candidates = promoted.filter(
            (task) =>
                task.status === 'ready' &&
                task.availableAt <= now &&
                TaskDagResolver.dependenciesSatisfied(task, dag),
        );
        const eligible = candidates.filter((task) => {
            const [, failures] = this.evaluator.evaluate(task.preconditions, {
                world: context.world,
                claims: context.claims,
                inventory: context.inventory,
            });
            return failures === null;
        });
        const ranked = TaskPriorityScheduler.rank(eligible, context);
        for (const task of ranked) {
            const lease = this.claimOne(task, context.botId, now);
            if (lease[1]) return [null, lease[1]];
            if (lease[0] !== null) return [lease[0], null];
        }
        return [null, null];
    }

    private promoteReady(
        tasks: readonly TaskRecord[],
        dag: TaskDag,
        actor: string,
        now: string,
    ): Result<readonly TaskRecord[], TaskFailure> {
        const promoted: TaskRecord[] = [];
        for (const task of tasks) {
            if (
                task.status !== 'pending' ||
                task.availableAt > now ||
                !TaskDagResolver.dependenciesSatisfied(task, dag)
            ) {
                promoted.push(task);
                continue;
            }
            const [ready, transitionError] = this.stateMachine.transition(
                task,
                'ready',
                actor,
                'dependencies satisfied',
                now,
            );
            if (transitionError) return [null, transitionError];
            if (ready !== null) promoted.push(ready);
        }
        return [promoted, null];
    }

    private claimOne(
        task: TaskRecord,
        botId: string,
        now: string,
    ): Result<TaskLease | null, TaskFailure> {
        const [token, tokenError] = this.repository.nextLeaseToken();
        if (tokenError) return [null, { type: 'STORAGE', failure: tokenError }];
        if (token === null) return [null, { type: 'MALFORMED_TASK', message: 'token missing' }];
        const leaseUntil = new Date(Date.parse(now) + this.leaseTtlMilliseconds).toISOString();
        const [claimed, claimError] = this.repository.claim(task.id, botId, leaseUntil, token, now);
        if (claimError) return [null, { type: 'STORAGE', failure: claimError }];
        if (claimed !== true) return [null, null];
        const [, eventError] = this.events.append({
            botId,
            type: 'task.transition',
            payload: {
                taskId: task.id,
                from: 'ready',
                to: 'claimed',
                actor: botId,
                reason: 'task claimed',
            },
            actor: botId,
            createdAt: now,
        });
        if (eventError) return [null, { type: 'STORAGE', failure: eventError }];
        return [
            {
                task: {
                    ...task,
                    status: 'claimed',
                    claimedBy: botId,
                    leaseUntil,
                    leaseToken: token,
                    updatedAt: now,
                },
                fencingToken: token,
                leaseUntil,
            },
            null,
        ];
    }
}

import type { Result } from '@ticrafter/core';
import type {
    PlannerCycleResult,
    PlannerSipProposalInput,
    PlannerTaskProposal,
} from '@ticrafter/planning';

import type { SipCommit, SipFailure } from '../sip/index.js';
import type { CreateTaskInput, TaskBoard, TaskFailure, TaskRecord } from '../tasks/index.js';
import { PlannerTaskMapper } from './task-mapper.js';

export interface PlannerSipCommitPort {
    commit(input: PlannerSipProposalInput): Result<SipCommit, SipFailure>;
}

export interface PlannerTaskPort {
    get(taskId: string): Result<TaskRecord | null, TaskFailure>;
    create(input: CreateTaskInput): Result<TaskRecord, TaskFailure>;
    cancel(
        taskId: string,
        actor: string,
        reason: string,
        now?: string,
    ): Result<TaskRecord, TaskFailure>;
}

export interface PlannerApplyReport {
    sipRevision: number | null;
    tasksCreated: number;
    tasksSkipped: number;
    tasksCancelled: number;
}

export interface PlannerCycleApplierPort {
    apply(cycle: PlannerCycleResult): Result<PlannerApplyReport, string>;
}

export interface PlannerCycleApplierOptions {
    sip: PlannerSipCommitPort;
    tasks: PlannerTaskPort;
}

export class PlannerCycleApplier implements PlannerCycleApplierPort {
    constructor(private readonly options: PlannerCycleApplierOptions) {}

    static forTaskBoard(sip: PlannerSipCommitPort, tasks: TaskBoard): PlannerCycleApplier {
        return new PlannerCycleApplier({ sip, tasks });
    }

    apply(cycle: PlannerCycleResult): Result<PlannerApplyReport, string> {
        if (!cycle.applicable) {
            return [
                { sipRevision: null, tasksCreated: 0, tasksSkipped: 0, tasksCancelled: 0 },
                null,
            ];
        }
        const [sipRevision, sipError] = this.commitSip(cycle.sipProposal);
        if (sipError) return [null, sipError];
        const [tasksCancelled, cancelError] = this.cancelTasks(cycle.taskCancellations);
        if (cancelError) return [null, cancelError];
        if (tasksCancelled === null) return [null, 'cancelled task count missing'];
        const [created, createError] = this.createTasks(cycle.taskProposals);
        if (createError) return [null, createError];
        if (created === null) return [null, 'task creation report missing'];
        return [
            {
                sipRevision,
                tasksCreated: created.tasksCreated,
                tasksSkipped: created.tasksSkipped,
                tasksCancelled,
            },
            null,
        ];
    }

    private cancelTasks(taskIds: readonly string[]): Result<number, string> {
        const openStatuses = new Set(['pending', 'ready', 'claimed', 'running']);
        let tasksCancelled = 0;
        for (const taskId of taskIds) {
            const [task, readError] = this.options.tasks.get(taskId);
            if (readError) return [null, JSON.stringify(readError)];
            if (task === null || !openStatuses.has(task.status)) continue;
            const [, cancelError] = this.options.tasks.cancel(
                taskId,
                'planner',
                'planner cancelled task',
            );
            if (cancelError) return [null, JSON.stringify(cancelError)];
            tasksCancelled += 1;
        }
        return [tasksCancelled, null];
    }

    private commitSip(proposal: PlannerSipProposalInput | null): Result<number | null, string> {
        if (proposal === null) return [null, null];
        const [commit, commitError] = this.options.sip.commit(proposal);
        if (commitError) return [null, JSON.stringify(commitError)];
        if (commit === null) return [null, 'SIP commit returned null'];
        return [commit.revision, null];
    }

    private createTasks(
        proposals: readonly PlannerTaskProposal[],
    ): Result<Pick<PlannerApplyReport, 'tasksCreated' | 'tasksSkipped'>, string> {
        let tasksCreated = 0;
        let tasksSkipped = 0;
        for (const proposal of proposals) {
            const [existing, readError] = this.options.tasks.get(proposal.id);
            if (readError) return [null, JSON.stringify(readError)];
            if (existing !== null) {
                tasksSkipped += 1;
                continue;
            }
            const [taskInput, mappingError] = PlannerTaskMapper.toTask(proposal);
            if (mappingError) return [null, mappingError];
            if (taskInput === null) return [null, 'task mapping returned null'];
            const [, createError] = this.options.tasks.create(taskInput);
            if (createError !== null && createError.type !== 'DUPLICATE_TASK') {
                return [null, JSON.stringify(createError)];
            }
            if (createError === null) {
                tasksCreated += 1;
                continue;
            }
            tasksSkipped += 1;
        }
        return [{ tasksCreated, tasksSkipped }, null];
    }
}

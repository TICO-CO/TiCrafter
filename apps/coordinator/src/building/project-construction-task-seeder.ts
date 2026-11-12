import type { PlannedWorkPackage } from '@ticrafter/building';
import type { Result } from '@ticrafter/core';

import type { ProjectConstructionTaskInput } from '../projects/index.js';
import type { CreateTaskInput, TaskBoard, TaskFailure, TaskRecord } from '../tasks/index.js';
import { ConstructionPackageManifest } from './construction-package-manifest.js';

export class ProjectConstructionTaskSeeder {
    constructor(private readonly tasks: TaskBoard) {}

    seed(input: ProjectConstructionTaskInput): Result<readonly string[], string> {
        const packages = ConstructionPackageManifest.packages(input.plan.plan);
        const taskIds = new Map<string, string>();
        packages.forEach((workPackage, index) => {
            taskIds.set(workPackage.id, `task.project.${input.projectId}.package.${index}`);
        });
        const created: string[] = [];
        for (const workPackage of packages) {
            const taskInput = this.taskInput(input, workPackage, taskIds);
            const [task, createError] = this.tasks.create(taskInput);
            if (createError) {
                this.cancel(input, created);
                return [null, ProjectConstructionTaskSeeder.describe(createError)];
            }
            if (task === null) {
                this.cancel(input, created);
                return [null, 'project task creation returned null'];
            }
            created.push(task.id);
        }
        return [created, null];
    }

    cancelTasks(
        taskIds: readonly string[],
        actor = 'coordinator',
        reason = 'project task cancelled',
        now = new Date().toISOString(),
    ): Result<void, string> {
        for (const taskId of taskIds) {
            const [task, readError] = this.tasks.get(taskId);
            if (readError) return [null, ProjectConstructionTaskSeeder.describe(readError)];
            if (task === null || task.status === 'cancelled' || task.status === 'completed') {
                continue;
            }
            const [, cancelError] = this.tasks.cancel(taskId, actor, reason, now);
            if (cancelError) return [null, ProjectConstructionTaskSeeder.describe(cancelError)];
        }
        return [undefined, null];
    }

    private taskInput(
        input: ProjectConstructionTaskInput,
        workPackage: PlannedWorkPackage,
        taskIds: ReadonlyMap<string, string>,
    ): CreateTaskInput {
        const claim = input.claims.find((candidate) => candidate.resourceId === workPackage.id);
        return {
            id: taskIds.get(workPackage.id) ?? `task.project.${input.projectId}.package`,
            title: `${input.title}: ${workPackage.phase}`,
            priority: 100 - workPackage.bbox.min.y,
            requiredRole: 'builder',
            target: ProjectConstructionTaskSeeder.center(workPackage),
            dependencies: workPackage.predecessorIds.flatMap((predecessor) => {
                const taskId = taskIds.get(predecessor);
                return taskId === undefined ? [] : [taskId];
            }),
            payload: {
                skillId: 'construction',
                projectId: input.projectId,
                structureId: input.structureId,
                ownerBotId: input.ownerBotId,
                visibleTo: input.collaboration === 'private' ? 'owner' : 'helpers',
                blueprintId: input.blueprint.id,
                blueprintRevision: input.blueprint.revision,
                planId: input.plan.id,
                planRevision: input.plan.revision,
                workPackageId: workPackage.id,
                ...(claim === undefined
                    ? {}
                    : { claimId: claim.claimId, fencingToken: claim.fencingToken }),
                bbox: workPackage.bbox,
            },
        };
    }

    private cancel(input: ProjectConstructionTaskInput, taskIds: readonly string[]): void {
        this.cancelTasks(taskIds, input.botId, 'project task seeding failed');
    }

    private static center(workPackage: PlannedWorkPackage): {
        x: number;
        y: number;
        z: number;
    } {
        return {
            x: Math.floor((workPackage.bbox.min.x + workPackage.bbox.max.x) / 2),
            y: workPackage.bbox.min.y,
            z: Math.floor((workPackage.bbox.min.z + workPackage.bbox.max.z) / 2),
        };
    }

    private static describe(failure: TaskFailure): string {
        if (failure.type === 'STORAGE') return failure.failure.type;
        if ('message' in failure) return `${failure.type}: ${failure.message}`;
        if ('taskId' in failure) return `${failure.type}: ${failure.taskId}`;
        return failure.type;
    }
}

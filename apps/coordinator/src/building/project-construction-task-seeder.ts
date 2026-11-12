import type { PlannedWorkPackage } from '@ticrafter/building';
import type { Result } from '@ticrafter/core';

import type { ProjectConstructionTaskInput } from '../projects/index.js';
import type { CreateTaskInput, TaskBoard, TaskFailure, TaskRecord } from '../tasks/index.js';
import { ConstructionPackageManifest } from './construction-package-manifest.js';

export class ProjectConstructionTaskSeeder {
    constructor(private readonly tasks: TaskBoard) {}

    seed(input: ProjectConstructionTaskInput): Result<readonly string[], string> {
        const packages = ConstructionPackageManifest.packages(input.plan.plan);
        const scope = ProjectConstructionTaskSeeder.scope(input.plan);
        const packageTaskIds = new Map<string, string>();
        const procurementTaskIds = new Map<string, string>();
        packages.forEach((workPackage, index) => {
            packageTaskIds.set(
                workPackage.id,
                `task.project.${input.projectId}${scope}.package.${index}`,
            );
            if (ProjectConstructionTaskSeeder.needsProcurement(workPackage)) {
                procurementTaskIds.set(
                    workPackage.id,
                    `task.project.${input.projectId}${scope}.procurement.${index}`,
                );
            }
        });
        const created: string[] = [];
        for (const workPackage of packages) {
            const procurementInput = this.procurementInput(
                input,
                workPackage,
                packageTaskIds,
                procurementTaskIds,
            );
            if (procurementInput !== null) {
                const [procurementTask, procurementError] = this.tasks.create(procurementInput);
                if (procurementError) {
                    this.cancel(input, created);
                    return [null, ProjectConstructionTaskSeeder.describe(procurementError)];
                }
                if (procurementTask === null) {
                    this.cancel(input, created);
                    return [null, 'project procurement task creation returned null'];
                }
                created.push(procurementTask.id);
            }
            const taskInput = this.taskInput(
                input,
                workPackage,
                packageTaskIds,
                procurementTaskIds,
            );
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

    cancelProjectTasks(projectId: string): Result<void, string> {
        const [tasks, listError] = this.tasks.list();
        if (listError) return [null, ProjectConstructionTaskSeeder.describe(listError)];
        if (tasks === null) return [null, 'task list missing'];
        const ids = tasks
            .filter((task) => task.payload.projectId === projectId)
            .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
            .map((task) => task.id);
        return this.cancelTasks(ids);
    }

    private static scope(plan: ProjectConstructionTaskInput['plan']): string {
        if (plan.purpose === 'build') return '';
        return `.${plan.purpose}.${plan.revision}`;
    }

    private taskInput(
        input: ProjectConstructionTaskInput,
        workPackage: PlannedWorkPackage,
        packageTaskIds: ReadonlyMap<string, string>,
        procurementTaskIds: ReadonlyMap<string, string>,
    ): CreateTaskInput {
        const claim = input.claims.find((candidate) => candidate.resourceId === workPackage.id);
        const procurementTaskId = procurementTaskIds.get(workPackage.id);
        return {
            id: packageTaskIds.get(workPackage.id) ?? `task.project.${input.projectId}.package`,
            title: `${input.title}: ${workPackage.phase}`,
            priority: 100 - workPackage.bbox.min.y,
            requiredRole: 'builder',
            target: ProjectConstructionTaskSeeder.center(workPackage),
            dependencies: [
                ...workPackage.predecessorIds.flatMap((predecessor) => {
                    const taskId = packageTaskIds.get(predecessor);
                    return taskId === undefined ? [] : [taskId];
                }),
                ...(procurementTaskId === undefined ? [] : [procurementTaskId]),
            ],
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

    private procurementInput(
        input: ProjectConstructionTaskInput,
        workPackage: PlannedWorkPackage,
        packageTaskIds: ReadonlyMap<string, string>,
        procurementTaskIds: ReadonlyMap<string, string>,
    ): CreateTaskInput | null {
        if (!ProjectConstructionTaskSeeder.needsProcurement(workPackage)) return null;
        const taskId = procurementTaskIds.get(workPackage.id);
        if (taskId === undefined) return null;
        return {
            id: taskId,
            title: `${input.title}: procure ${workPackage.phase}`,
            priority: 100 - workPackage.bbox.min.y,
            requiredRole: 'builder',
            target: ProjectConstructionTaskSeeder.center(workPackage),
            dependencies: workPackage.predecessorIds.flatMap((predecessor) => {
                const predecessorTaskId = packageTaskIds.get(predecessor);
                return predecessorTaskId === undefined ? [] : [predecessorTaskId];
            }),
            payload: {
                skillId: 'procurement',
                projectId: input.projectId,
                structureId: input.structureId,
                ownerBotId: input.ownerBotId,
                visibleTo: input.collaboration === 'private' ? 'owner' : 'helpers',
                blueprintId: input.blueprint.id,
                blueprintRevision: input.blueprint.revision,
                planId: input.plan.id,
                planRevision: input.plan.revision,
                workPackageId: workPackage.id,
                bbox: workPackage.bbox,
            },
        };
    }

    private static needsProcurement(workPackage: PlannedWorkPackage): boolean {
        return workPackage.materials.length > 0 && workPackage.phase !== 'cleanup';
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

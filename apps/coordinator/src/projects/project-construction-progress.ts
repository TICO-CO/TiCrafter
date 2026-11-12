import type { LoggerPort, Result } from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { ClaimService } from '../claims/index.js';
import type { GrantService } from '../grants/index.js';
import type { SipMutation, SipSnapshot, SipWorkPackage } from '../sip/index.js';
import type { TaskBoard, TaskRecord } from '../tasks/index.js';
import type { PersonalProjectRepository } from './project-repository.js';
import type { PersonalProjectRecord } from './types.js';

export interface ProjectConstructionProgressOptions {
    tasks: TaskBoard;
    projects: PersonalProjectRepository;
    claims: ClaimService;
    grants: GrantService;
    sip: {
        loadSnapshot(): Result<SipSnapshot, unknown>;
        commit(input: {
            metadata: {
                actor: string;
                expectedRevision: number;
                idempotencyKey: string;
            };
            mutations: readonly SipMutation[];
        }): Result<{ revision: number }, unknown>;
    };
    events: EventLogWriter;
    logger: LoggerPort;
    now?: () => string;
}

export class ProjectConstructionProgressService {
    private readonly now: () => string;

    constructor(private readonly options: ProjectConstructionProgressOptions) {
        this.now = options.now ?? (() => new Date().toISOString());
    }

    reconcile(): Result<readonly PersonalProjectRecord[], string> {
        const [tasks, taskError] = this.options.tasks.list();
        if (taskError) return [null, 'task list unavailable'];
        if (tasks === null) return [null, 'task list missing'];
        const [projects, projectError] = this.options.projects.listActive();
        if (projectError) return [null, 'active project list unavailable'];
        if (projects === null) return [null, 'active project list missing'];
        const [snapshot, snapshotError] = this.options.sip.loadSnapshot();
        if (snapshotError) return [null, String(snapshotError)];
        if (snapshot === null) return [null, 'sip snapshot missing'];
        const updates = projects.flatMap((project) =>
            this.update(
                project,
                ProjectConstructionProgressService.structureFor(snapshot, project),
                tasks,
            ),
        );
        if (updates.length === 0) return [[], null];
        const [, commitError] = this.options.sip.commit({
            metadata: {
                actor: 'coordinator',
                expectedRevision: snapshot.revision,
                idempotencyKey: `project-progress:${snapshot.revision}:${updates
                    .map((update) => update.project.id)
                    .join(',')}`,
            },
            mutations: updates.map((update) => ({
                kind: 'structure.upsert',
                structure: update.structure,
            })),
        });
        if (commitError) return [null, 'project progress commit failed'];
        const completed = updates.flatMap((update) =>
            update.complete ? [this.complete(update.project)] : [],
        );
        return [completed, null];
    }

    private update(
        project: PersonalProjectRecord,
        structure: SipSnapshot['structures'][number] | null,
        tasks: readonly TaskRecord[],
    ): readonly {
        project: PersonalProjectRecord;
        structure: SipSnapshot['structures'][number];
        complete: boolean;
    }[] {
        if (structure === null || structure.workPackages.length === 0) return [];
        const completedTasks = tasks.filter(
            (task) =>
                task.status === 'completed' &&
                task.payload.projectId === project.id &&
                typeof task.payload.workPackageId === 'string',
        );
        completedTasks.forEach((task) => {
            const [, grantError] = this.options.grants.revokeForTask(task.id);
            if (grantError) {
                this.options.logger.warn({ error: grantError }, 'helper grant revoke failed');
            }
        });
        const completed = new Set(
            completedTasks.map((task) => task.payload.workPackageId as string),
        );
        const workPackages: SipWorkPackage[] = structure.workPackages.map((workPackage) =>
            completed.has(workPackage.id)
                ? { ...workPackage, status: 'complete', claimedBy: null }
                : workPackage,
        );
        const changed = workPackages.some(
            (workPackage, index) => workPackage.status !== structure.workPackages[index]?.status,
        );
        const complete = workPackages.every((workPackage) => workPackage.status === 'complete');
        if (changed === false && complete === false) return [];
        return [
            {
                project,
                structure: {
                    ...structure,
                    status: complete ? 'complete' : 'building',
                    progress:
                        workPackages.filter((workPackage) => workPackage.status === 'complete')
                            .length / workPackages.length,
                    workPackages,
                },
                complete,
            },
        ];
    }

    private static structureFor(
        snapshot: SipSnapshot,
        project: PersonalProjectRecord,
    ): SipSnapshot['structures'][number] | null {
        if (project.structureId === null) return null;
        return (
            snapshot.structures.find((structure) => structure.id === project.structureId) ?? null
        );
    }

    private complete(project: PersonalProjectRecord): PersonalProjectRecord {
        const now = this.now();
        const completed: PersonalProjectRecord = {
            ...project,
            status: 'completed',
            claims: [],
            updatedAt: now,
        };
        const [, updateError] = this.options.projects.update(completed);
        if (updateError) {
            this.options.logger.warn({ error: updateError }, 'project completion update failed');
        }
        [...project.claims].reverse().forEach((claim) => {
            const [, releaseError] = this.options.claims.release(
                claim.claimId,
                project.botId,
                claim.fencingToken,
                now,
            );
            if (releaseError) {
                this.options.logger.warn({ error: releaseError }, 'project claim release failed');
            }
        });
        if (project.structureId !== null) {
            const [, grantError] = this.options.grants.revokeForStructure(project.structureId, now);
            if (grantError) {
                this.options.logger.warn({ error: grantError }, 'project grant revoke failed');
            }
        }
        this.options.events.append({
            type: 'project.completed',
            botId: project.botId,
            actor: 'coordinator',
            payload: { projectId: project.id, structureId: project.structureId },
            createdAt: now,
        });
        return completed;
    }
}

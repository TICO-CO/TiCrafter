import type { LoggerPort, Result } from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import type { ClaimService } from '../claims/index.js';
import type { GrantService } from '../grants/index.js';
import { SipFixtures, type SipSnapshot } from '../sip/index.js';
import type { TaskBoard, TaskRecord } from '../tasks/index.js';
import { ProjectConstructionProgressService } from './project-construction-progress.js';
import type { PersonalProjectRepository } from './project-repository.js';
import type { PersonalProjectRecord } from './types.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const project: PersonalProjectRecord = {
    id: 'project-1',
    botId: 'bot.one',
    title: 'Home',
    kind: 'home',
    status: 'active',
    anchor: { x: 0, y: 64, z: 0 },
    bbox: { min: { x: -2, y: 64, z: -2 }, max: { x: 2, y: 66, z: 2 } },
    claims: [],
    structureId: 'structure.house',
    storageId: null,
    reason: null,
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
};

function task(overrides: Partial<TaskRecord>): TaskRecord {
    return {
        id: 'task-1',
        parentId: null,
        title: 'task',
        status: 'pending',
        priority: 1,
        retryCount: 0,
        payload: {},
        dependencies: [],
        preconditions: [],
        requiredRole: 'builder',
        target: null,
        claimedBy: null,
        leaseUntil: null,
        leaseToken: null,
        availableAt: '2026-11-12T10:00:00.000Z',
        failureClass: null,
        deadLetterReason: null,
        createdAt: '2026-11-12T10:00:00.000Z',
        updatedAt: '2026-11-12T10:00:00.000Z',
        completedAt: null,
        ...overrides,
    };
}

function service(tasks: readonly TaskRecord[]): {
    progress: ProjectConstructionProgressService;
    commits: () => number;
} {
    let commitCount = 0;
    const snapshot: SipSnapshot = {
        ...SipFixtures.snapshot(),
        structures: [
            SipFixtures.structure({
                id: 'structure.house',
                workPackages: [
                    {
                        id: 'work-package.shell',
                        bbox: {
                            min: { x: -2, y: 64, z: -2 },
                            max: { x: 2, y: 66, z: 2 },
                        },
                        status: 'planned',
                        claimedBy: null,
                    },
                ],
            }),
        ],
    };
    return {
        progress: new ProjectConstructionProgressService({
            tasks: { list: () => [tasks, null] } as unknown as TaskBoard,
            projects: {
                listActive: () => [[project], null],
                update: () => [undefined, null],
            } as unknown as PersonalProjectRepository,
            claims: { release: () => [undefined, null] } as unknown as ClaimService,
            grants: {
                revokeForTask: () => [undefined, null],
                revokeForStructure: () => [undefined, null],
            } as unknown as GrantService,
            sip: {
                loadSnapshot: (): Result<SipSnapshot, unknown> => [snapshot, null],
                commit: () => {
                    commitCount += 1;
                    return [{ revision: snapshot.revision + 1 }, null];
                },
            },
            events: { append: () => [undefined, null] } as unknown as EventLogWriter,
            logger,
        }),
        commits: () => commitCount,
    };
}

describe('ProjectConstructionProgressService', () => {
    it('does not complete a package from a completed procurement task', () => {
        const { progress, commits } = service([
            task({
                id: 'task.project.project-1.procurement.0',
                status: 'completed',
                payload: {
                    skillId: 'procurement',
                    projectId: 'project-1',
                    workPackageId: 'work-package.shell',
                },
            }),
            task({
                id: 'task.project.project-1.package.0',
                payload: {
                    skillId: 'construction',
                    projectId: 'project-1',
                    workPackageId: 'work-package.shell',
                },
            }),
        ]);

        const [completed, error] = progress.reconcile();

        expect(error).toBeNull();
        expect(completed).toEqual([]);
        expect(commits()).toBe(0);
    });

    it('completes a package from its construction task', () => {
        const { progress, commits } = service([
            task({
                id: 'task.project.project-1.package.0',
                status: 'completed',
                payload: {
                    skillId: 'construction',
                    projectId: 'project-1',
                    workPackageId: 'work-package.shell',
                },
            }),
        ]);

        const [completed, error] = progress.reconcile();

        expect(error).toBeNull();
        expect(completed).toHaveLength(1);
        expect(commits()).toBe(1);
    });
});

import type { BlueprintDocument, ConstructionPlanDocument } from '@ticrafter/building';
import { EventLogWriter, TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { TaskBoard, TaskFixtures } from '../tasks/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { ProjectConstructionTaskSeeder } from './project-construction-task-seeder.js';

const now = '2026-11-12T10:00:00.000Z';

const blueprint: BlueprintDocument = {
    id: 'blueprint.project-1',
    revision: 1,
    hash: 'blueprint-hash',
    source: 'composed',
    provenance: { createdBy: 'bot.one', createdAt: now },
    blueprint: {
        id: 'blueprint.project-1',
        anchor: { x: 0, y: 64, z: 0 },
        rotation: 0,
        blocks: [],
        materials: [],
        constraints: [],
    },
};

const plan: ConstructionPlanDocument = {
    id: 'plan.structure-1',
    revision: 1,
    hash: 'plan-hash',
    structureId: 'structure-1',
    blueprintId: blueprint.id,
    blueprintRevision: 1,
    purpose: 'build',
    createdAt: now,
    plan: {
        id: 'plan.structure-1',
        blueprintId: blueprint.id,
        anchor: { x: 0, y: 64, z: 0 },
        rotation: 0,
        translation: { x: 0, y: 0, z: 0 },
        site: {
            anchor: { x: 0, y: 64, z: 0 },
            translation: { x: 0, y: 0, z: 0 },
            rotation: 0,
            bounds: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 66, z: 2 } },
            clearance: [],
            access: { kind: 'none', from: null, to: { x: 0, y: 64, z: 0 }, length: 0 },
            foundationMode: 'level',
            foundationFillDepth: 0,
            foundationCutDepth: 0,
            score: 100,
            rationale: [],
        },
        foundation: {
            mode: 'level',
            targetY: 64,
            maximumFillDepth: 0,
            changes: [],
            materials: [],
            rationale: [],
        },
        changes: [],
        order: [],
        dependencies: [],
        scaffolds: [],
        unreachable: [],
        phases: [],
        materials: [],
        workPackages: [
            {
                id: 'plan.structure-1:layers:foundation:0',
                bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 64, z: 2 } },
                blockKeys: ['0,64,0'],
                strategy: 'layers',
                status: 'planned',
                phase: 'foundation',
                materials: [{ item: 'cobblestone', count: 1 }],
                scaffoldPositions: [],
                predecessorIds: [],
            },
            {
                id: 'plan.structure-1:layers:walls:0',
                bbox: { min: { x: 0, y: 65, z: 0 }, max: { x: 2, y: 66, z: 2 } },
                blockKeys: ['0,65,0'],
                strategy: 'layers',
                status: 'planned',
                phase: 'walls',
                materials: [{ item: 'oak_planks', count: 1 }],
                scaffoldPositions: [],
                predecessorIds: ['plan.structure-1:layers:foundation:0'],
            },
        ],
    },
};

describe('ProjectConstructionTaskSeeder', () => {
    const fresh = (): { board: TaskBoard; seeder: ProjectConstructionTaskSeeder } => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const board = new TaskBoard({
            database: coordinatorDatabase,
            events: new EventLogWriter(coordinatorDatabase),
            transactions: new TransactionManager(coordinatorDatabase),
            world: TaskFixtures.world(),
            claims: TaskFixtures.claims(),
        });
        return { board, seeder: new ProjectConstructionTaskSeeder(board) };
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('creates one owner or helper task per package with dependencies', () => {
        const { board, seeder } = fresh();
        const [taskIds, error] = seeder.seed({
            projectId: 'project-1',
            structureId: 'structure-1',
            title: 'Home',
            botId: 'bot.one',
            ownerBotId: 'bot.one',
            collaboration: 'open',
            blueprint,
            plan,
            claims: plan.plan.workPackages.map((workPackage, index) => ({
                claimId: `claim-${index}`,
                fencingToken: index + 1,
                resourceId: workPackage.id,
                resourceType: 'work_package' as const,
            })),
        });
        expect(error).toBeNull();
        expect(taskIds).toEqual([
            'task.project.project-1.procurement.0',
            'task.project.project-1.package.0',
            'task.project.project-1.procurement.1',
            'task.project.project-1.package.1',
        ]);
        const foundationProcurement = board.get('task.project.project-1.procurement.0')[0];
        const foundation = board.get('task.project.project-1.package.0')[0];
        const wallsProcurement = board.get('task.project.project-1.procurement.1')[0];
        const walls = board.get('task.project.project-1.package.1')[0];
        expect(foundationProcurement?.dependencies).toEqual([]);
        expect(foundation?.dependencies).toEqual(['task.project.project-1.procurement.0']);
        expect(wallsProcurement?.dependencies).toEqual(['task.project.project-1.package.0']);
        expect(walls?.dependencies).toEqual([
            'task.project.project-1.package.0',
            'task.project.project-1.procurement.1',
        ]);
        expect(foundationProcurement?.payload.skillId).toBe('procurement');
        expect(foundation?.payload.skillId).toBe('construction');
        expect(foundation?.payload.visibleTo).toBe('helpers');
        expect(walls?.payload.planId).toBe('plan.structure-1');
        expect(walls?.payload.claimId).toBe('claim-1');
        expect(wallsProcurement?.payload.claimId).toBe(undefined);
    });

    it('seeds a cleanup task after scaffolded packages without procurement', () => {
        const { board, seeder } = fresh();
        const scaffoldedPlan: ConstructionPlanDocument = {
            ...plan,
            plan: {
                ...plan.plan,
                scaffolds: [
                    {
                        position: { x: 0, y: 65, z: 0 },
                        stateName: 'dirt',
                        targetKeys: ['0,65,0'],
                        removalPhase: 'scaffold-removal',
                    },
                ],
            },
        };
        const [taskIds, error] = seeder.seed({
            projectId: 'project-scaffold',
            structureId: 'structure-scaffold',
            title: 'Scaffolded home',
            botId: 'bot.one',
            ownerBotId: 'bot.one',
            collaboration: 'private',
            blueprint,
            plan: scaffoldedPlan,
            claims: [],
        });
        expect(error).toBeNull();
        expect(taskIds).toEqual([
            'task.project.project-scaffold.procurement.0',
            'task.project.project-scaffold.package.0',
            'task.project.project-scaffold.procurement.1',
            'task.project.project-scaffold.package.1',
            'task.project.project-scaffold.package.2',
        ]);
        const cleanup = board.get('task.project.project-scaffold.package.2')[0];
        expect(cleanup?.payload.skillId).toBe('construction');
        expect(cleanup?.payload.workPackageId).toBe('plan.structure-1:cleanup');
        expect(cleanup?.dependencies).toEqual([
            'task.project.project-scaffold.package.0',
            'task.project.project-scaffold.package.1',
        ]);
        expect(board.get('task.project.project-scaffold.procurement.2')[0]).toBeNull();
    });
});

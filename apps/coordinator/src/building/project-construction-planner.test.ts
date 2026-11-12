import type {
    PositionedWorldBlock,
    WorldBlockQueryPort,
    WorldBlockState,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { BlueprintDocumentService } from './blueprint-document-service.js';
import { BlueprintDocumentRepository } from './blueprint-repository.js';
import { ConstructionPlanDocumentService } from './construction-plan-document-service.js';
import { ConstructionPlanRepository } from './construction-plan-repository.js';
import { ProjectConstructionPlanner } from './project-construction-planner.js';

class FlatWorld implements WorldBlockQueryPort {
    blockAt(position: Vec3): Result<WorldBlockState | null, never> {
        return [position.y <= 63 ? { name: 'stone' } : null, null];
    }

    blocksInBox(bounds: { min: Vec3; max: Vec3 }): Result<readonly PositionedWorldBlock[], never> {
        const blocks: PositionedWorldBlock[] = [];
        for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
            for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
                blocks.push({ name: 'stone', position: { x, y: 63, z } });
            }
        }
        return [blocks, null];
    }
}

class UnevenWorld implements WorldBlockQueryPort {
    blockAt(position: Vec3): Result<WorldBlockState | null, never> {
        return [position.y <= (position.x <= 0 ? 63 : 71) ? { name: 'stone' } : null, null];
    }

    blocksInBox(bounds: { min: Vec3; max: Vec3 }): Result<readonly PositionedWorldBlock[], never> {
        const blocks: PositionedWorldBlock[] = [];
        for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
            for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
                const height = x <= 0 ? 63 : 71;
                for (let y = bounds.min.y; y <= Math.min(bounds.max.y, height); y += 1) {
                    blocks.push({ name: 'stone', position: { x, y, z } });
                }
            }
        }
        return [blocks, null];
    }
}

const openPlanner = (
    world: WorldBlockQueryPort = new FlatWorld(),
): {
    planner: ProjectConstructionPlanner;
    plans: ConstructionPlanDocumentService;
} | null => {
    const [database, openError] = CoordinatorTestSupport.openDatabase();
    if (openError) return null;
    if (database === null) return null;
    const coordinatorDatabase = database as CoordinatorDatabase;
    const blueprints = new BlueprintDocumentService({
        documents: new BlueprintDocumentRepository(coordinatorDatabase),
        now: () => '2026-11-12T12:00:00.000Z',
    });
    const plans = new ConstructionPlanDocumentService({
        plans: new ConstructionPlanRepository(coordinatorDatabase),
        now: () => '2026-11-12T12:00:00.000Z',
    });
    return {
        planner: new ProjectConstructionPlanner({
            world,
            blueprints,
            plans,
            maxStructureBlocks: 4000,
            maxWorkPackageBlocks: 64,
        }),
        plans,
    };
};

afterEach(() => CoordinatorTestSupport.cleanup());

describe('ProjectConstructionPlanner', () => {
    it('composes a blueprint, stores the plan, and returns namespaced packages', () => {
        const opened = openPlanner();
        if (opened === null) return;
        const [result, error] = opened.planner.prepare({
            projectId: 'project-1',
            structureId: 'structure.project.project-1',
            botId: 'bot.one',
            kind: 'home',
            anchor: { x: 0, y: 64, z: 0 },
            bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 6, y: 69, z: 6 } },
        });
        expect(error).toBeNull();
        expect(result).not.toBeNull();
        expect(result?.plan.revision).toBe(1);
        expect(result?.plan.id).toBe('plan.structure.project.project-1');
        expect((result?.plan.plan.workPackages.length ?? 0) > 0).toBe(true);
        expect(
            result?.plan.plan.workPackages.every((workPackage) =>
                workPackage.id.startsWith('plan.structure.project.project-1:'),
            ),
        ).toBe(true);
        expect(opened.plans.get('plan.structure.project.project-1', 1)[0]?.hash).toHaveLength(64);
    });

    it('selects a nearby flat site when the requested anchor is too steep', () => {
        const opened = openPlanner(new UnevenWorld());
        if (opened === null) return;
        const [result, error] = opened.planner.prepare({
            projectId: 'project-uneven',
            structureId: 'structure.project.project-uneven',
            botId: 'bot.one',
            kind: 'home',
            anchor: { x: 0, y: 64, z: 0 },
            bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 4, y: 68, z: 4 } },
        });
        expect(error).toBeNull();
        expect(result).not.toBeNull();
        expect(result?.plan.plan.site.anchor.x).not.toBe(0);
        expect(result?.plan.plan.foundation.changes).toHaveLength(0);
    });

    it('rejects an unobserved site as retryable', () => {
        const opened = openPlanner();
        if (opened === null) return;
        const [result, error] = opened.planner.prepare({
            projectId: 'project-2',
            structureId: 'structure.project.project-2',
            botId: 'bot.one',
            kind: 'home',
            anchor: { x: 0, y: 200, z: 0 },
            bbox: { min: { x: 0, y: 200, z: 0 }, max: { x: 6, y: 205, z: 6 } },
        });
        expect(result).toBeNull();
        expect(error?.type).toBe('SITE_UNAVAILABLE');
    });
});

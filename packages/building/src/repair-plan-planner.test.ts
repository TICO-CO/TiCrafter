import type { Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Blueprint } from './blueprint-ir.js';
import type { ConstructionPlan } from './construction-types.js';
import { RepairPlanPlanner } from './repair-plan-planner.js';
import type {
    PositionedWorldBlock,
    WorldBlockQueryPort,
    WorldBlockState,
} from './schematic-diff.js';

function key(position: Vec3): string {
    return `${position.x},${position.y},${position.z}`;
}

class FakeWorld implements WorldBlockQueryPort {
    private readonly blocks = new Map<string, WorldBlockState>();

    constructor(blocks: readonly (WorldBlockState & { position: Vec3 })[]) {
        blocks.forEach((block) => this.blocks.set(key(block.position), block));
    }

    blockAt(position: Vec3): Result<WorldBlockState | null, never> {
        return [this.blocks.get(key(position)) ?? null, null];
    }

    blocksInBox(bounds: { min: Vec3; max: Vec3 }): Result<readonly PositionedWorldBlock[], never> {
        return [
            [...this.blocks.entries()]
                .map(([position, block]) => ({
                    ...block,
                    position: {
                        x: Number(position.split(',')[0]),
                        y: Number(position.split(',')[1]),
                        z: Number(position.split(',')[2]),
                    },
                }))
                .filter(
                    (block) =>
                        block.position.x >= bounds.min.x &&
                        block.position.x <= bounds.max.x &&
                        block.position.y >= bounds.min.y &&
                        block.position.y <= bounds.max.y &&
                        block.position.z >= bounds.min.z &&
                        block.position.z <= bounds.max.z,
                ),
            null,
        ];
    }
}

const blueprint: Blueprint = {
    id: 'blueprint-home',
    anchor: { x: 0, y: 0, z: 0 },
    rotation: 0,
    blocks: [
        { x: 0, y: 0, z: 0, state: { name: 'cobblestone' }, priority: 0 },
        { x: 2, y: 0, z: 0, state: { name: 'oak_planks' }, priority: 1 },
    ],
    materials: [],
    constraints: [],
};

const basePlan: ConstructionPlan = {
    id: 'plan-home',
    blueprintId: 'blueprint-home',
    anchor: { x: 10, y: 64, z: 4 },
    rotation: 0,
    translation: { x: 10, y: 64, z: 4 },
    site: {
        anchor: { x: 10, y: 64, z: 4 },
        translation: { x: 10, y: 64, z: 4 },
        rotation: 0,
        bounds: { min: { x: 10, y: 64, z: 4 }, max: { x: 12, y: 64, z: 4 } },
        clearance: [],
        access: { kind: 'none', from: null, to: { x: 10, y: 64, z: 4 }, length: 0 },
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
    changes: [
        {
            kind: 'place',
            block: { x: 10, y: 64, z: 4, state: { name: 'cobblestone' }, priority: 0 },
            phase: 'foundation',
            reason: 'blueprint',
            dependsOn: [],
        },
        {
            kind: 'place',
            block: { x: 12, y: 64, z: 4, state: { name: 'oak_planks' }, priority: 1 },
            phase: 'walls',
            reason: 'blueprint',
            dependsOn: [],
        },
    ],
    order: [],
    dependencies: [],
    scaffolds: [],
    unreachable: [],
    phases: [],
    materials: [],
    workPackages: [],
};

describe('RepairPlanPlanner', () => {
    it('creates repairs for missing and mismatched blocks and breaks extras', () => {
        const world = new FakeWorld([
            { position: { x: 10, y: 64, z: 4 }, name: 'dirt' },
            { position: { x: 11, y: 64, z: 4 }, name: 'stone' },
        ]);
        const [plan, error] = new RepairPlanPlanner({ planId: 'plan-home:repair' }).plan(
            blueprint,
            basePlan,
            world,
        );
        expect(error).toBeNull();
        expect(plan?.id).toBe('plan-home:repair');
        expect(plan?.changes.map((change) => change.kind)).toEqual(['break', 'place', 'place']);
        expect(plan?.changes[0]?.block.state.name).toBe('stone');
        expect(plan?.materials).toEqual([
            { item: 'cobblestone', count: 1 },
            { item: 'oak_planks', count: 1 },
        ]);
        expect((plan?.workPackages.length ?? 0) > 0).toBe(true);
        expect(
            plan?.workPackages.every((workPackage) =>
                workPackage.id.startsWith('plan-home:repair'),
            ),
        ).toBe(true);
    });

    it('rejects a repair with no differences', () => {
        const world = new FakeWorld([
            { position: { x: 10, y: 64, z: 4 }, name: 'cobblestone' },
            { position: { x: 12, y: 64, z: 4 }, name: 'oak_planks' },
        ]);
        const [plan, error] = new RepairPlanPlanner().plan(blueprint, basePlan, world);
        expect(plan).toBeNull();
        expect(error?.type).toBe('INVALID_CONSTRUCTION_PLAN');
    });
});

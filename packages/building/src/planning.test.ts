import type { Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Blueprint, BlueprintBlock } from './blueprint-ir.js';
import { BuildOrderPlanner } from './build-order-planner.js';
import type { BuildingFailure } from './failures.js';
import { ReachabilityScaffoldPlanner } from './reachability-scaffold-planner.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';
import { WorkPackagePartitioner } from './work-package-partitioner.js';

class ReachabilityWorld implements WorldBlockQueryPort {
    constructor(private readonly blocks: Readonly<Record<string, string>> = {}) {}

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        const name = this.blocks[`${position.x},${position.y},${position.z}`];
        return [name === undefined ? null : { name }, null];
    }
}

const PLANNING_BLUEPRINT: Blueprint = {
    id: 'planning.test',
    anchor: { x: 0, y: 0, z: 0 },
    rotation: 0,
    blocks: [
        { x: 0, y: 0, z: 0, state: { name: 'stone' }, priority: 0 },
        { x: 1, y: 0, z: 0, state: { name: 'stone' }, priority: 0 },
        { x: 0, y: 1, z: 0, state: { name: 'oak_planks' }, priority: 1 },
        { x: 1, y: 1, z: 0, state: { name: 'oak_planks' }, priority: 1 },
        { x: 0, y: 2, z: 0, state: { name: 'glass' }, priority: 2 },
        { x: 1, y: 2, z: 0, state: { name: 'glass' }, priority: 2 },
    ],
    materials: [],
    constraints: [],
};

describe('WorkPackagePartitioner', () => {
    const partitioner = new WorkPackagePartitioner();

    it('covers every block exactly once by layer', () => {
        const [packages, packageError] = partitioner.partition(PLANNING_BLUEPRINT, {
            strategy: 'layers',
        });

        expect(packageError).toBeNull();
        expect(packages).toHaveLength(3);
        const keys = packages?.flatMap((workPackage) => workPackage.blockKeys) ?? [];
        expect(keys).toHaveLength(PLANNING_BLUEPRINT.blocks.length);
        expect(new Set(keys).size).toBe(PLANNING_BLUEPRINT.blocks.length);
    });

    it('splits large groups by the maximum package size', () => {
        const [packages, packageError] = partitioner.partition(PLANNING_BLUEPRINT, {
            strategy: 'single',
            maxBlocks: 2,
        });

        expect(packageError).toBeNull();
        expect(packages).toHaveLength(3);
        expect(packages?.every((workPackage) => workPackage.blockKeys.length <= 2)).toBe(true);
    });

    it('partitions quadrants deterministically', () => {
        const [first, firstError] = partitioner.partition(PLANNING_BLUEPRINT, {
            strategy: 'quadrants',
        });
        const [second, secondError] = partitioner.partition(PLANNING_BLUEPRINT, {
            strategy: 'quadrants',
        });

        expect(firstError).toBeNull();
        expect(secondError).toBeNull();
        expect(first?.map((workPackage) => workPackage.id)).toEqual(
            second?.map((workPackage) => workPackage.id),
        );
    });
});

describe('BuildOrderPlanner', () => {
    it('places supports before supported blocks', () => {
        const planner = new BuildOrderPlanner();
        const [ordered, orderError] = planner.plan(PLANNING_BLUEPRINT);

        expect(orderError).toBeNull();
        const keys = ordered?.map((entry) => `${entry.block.x},${entry.block.y},${entry.block.z}`);
        expect(keys?.[0]).toBe('0,0,0');
        expect(keys?.[1]).toBe('1,0,0');
        expect((keys?.indexOf('0,1,0') ?? -1) > (keys?.indexOf('0,0,0') ?? -1)).toBe(true);
        expect((keys?.indexOf('0,2,0') ?? -1) > (keys?.indexOf('0,1,0') ?? -1)).toBe(true);
    });

    it('can order only one work package', () => {
        const partitioner = new WorkPackagePartitioner();
        const [packages] = partitioner.partition(PLANNING_BLUEPRINT, { strategy: 'single' });
        if (packages === null) return;
        const planner = new BuildOrderPlanner();
        const [ordered, orderError] = planner.plan(PLANNING_BLUEPRINT, packages);

        expect(orderError).toBeNull();
        expect(ordered).toHaveLength(PLANNING_BLUEPRINT.blocks.length);
    });
});

describe('ReachabilityScaffoldPlanner', () => {
    const target: BlueprintBlock = {
        x: 0,
        y: 0,
        z: 0,
        state: { name: 'stone' },
        priority: 0,
    };
    const blocks = [target];

    it('uses direct reach when the bot is close', () => {
        const planner = new ReachabilityScaffoldPlanner(new ReachabilityWorld());
        const [plan, planError] = planner.plan(blocks, { x: 4, y: 0, z: 0 });

        expect(planError).toBeNull();
        expect(plan?.steps[0]?.direct).toBe(true);
        expect(plan?.unreachable).toHaveLength(0);
    });

    it('uses an existing support as a standing position', () => {
        const world = new ReachabilityWorld({ '1,-1,0': 'stone' });
        const planner = new ReachabilityScaffoldPlanner(world);
        const [plan, planError] = planner.plan(blocks, { x: 10, y: 0, z: 10 });

        expect(planError).toBeNull();
        expect(plan?.steps[0]?.standingPosition).toEqual({ x: 1, y: 0, z: 0 });
        expect(plan?.steps[0]?.scaffold).toHaveLength(0);
    });

    it('plans a supported scaffold stack when support is missing', () => {
        const world = new ReachabilityWorld({ '1,-4,0': 'stone' });
        const planner = new ReachabilityScaffoldPlanner(world);
        const [plan, planError] = planner.plan(blocks, { x: 10, y: 0, z: 10 });

        expect(planError).toBeNull();
        expect(plan?.steps[0]?.scaffold).toEqual([
            { position: { x: 1, y: -1, z: 0 }, stateName: 'dirt' },
            { position: { x: 1, y: -2, z: 0 }, stateName: 'dirt' },
            { position: { x: 1, y: -3, z: 0 }, stateName: 'dirt' },
        ]);
    });

    it('plans a tall scaffold stack down to existing ground', () => {
        const tallTarget: BlueprintBlock = {
            x: 0,
            y: 6,
            z: 0,
            state: { name: 'oak_planks' },
            priority: 1,
        };
        const world = new ReachabilityWorld({ '1,-1,0': 'stone' });
        const planner = new ReachabilityScaffoldPlanner(world);
        const [plan, planError] = planner.plan([tallTarget], { x: 10, y: 0, z: 10 });

        expect(planError).toBeNull();
        expect(plan?.steps[0]?.scaffold.map((block) => block.position.y)).toEqual([
            5, 4, 3, 2, 1, 0,
        ]);
    });

    it('marks targets unreachable when all candidates are occupied', () => {
        const world = new ReachabilityWorld({
            '1,0,0': 'stone',
            '-1,0,0': 'stone',
            '0,0,1': 'stone',
            '0,0,-1': 'stone',
        });
        const planner = new ReachabilityScaffoldPlanner(world);
        const [plan, planError] = planner.plan(blocks, { x: 10, y: 0, z: 10 });

        expect(planError).toBeNull();
        expect(plan?.unreachable).toHaveLength(1);
    });
});

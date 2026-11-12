import type { Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Blueprint } from './blueprint-ir.js';
import { BlueprintIr } from './blueprint-ir.js';
import { ConstructionPlanPlanner } from './construction-plan-planner.js';
import type { SitePlan } from './construction-types.js';
import type { BuildingFailure } from './failures.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';

class GroundWorld implements WorldBlockQueryPort {
    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        if (position.y <= 63) return [{ name: 'stone' }, null];
        return [null, null];
    }
}

const BLUEPRINT: Blueprint = {
    id: 'blueprint.construction',
    anchor: { x: 0, y: 0, z: 0 },
    rotation: 0,
    blocks: [
        { x: 0, y: 0, z: 0, state: { name: 'oak_planks' }, priority: 0 },
        { x: 1, y: 0, z: 0, state: { name: 'oak_planks' }, priority: 0 },
        { x: 0, y: 0, z: 1, state: { name: 'oak_planks' }, priority: 0 },
        { x: 1, y: 0, z: 1, state: { name: 'oak_planks' }, priority: 0 },
        { x: 0, y: 0, z: 0, state: { name: 'torch' }, priority: 6 },
    ],
    materials: [
        { item: 'oak_planks', count: 4 },
        { item: 'torch', count: 1 },
    ],
    constraints: [],
};

const FLOATING: Blueprint = {
    ...BLUEPRINT,
    blocks: [
        ...BLUEPRINT.blocks.filter((block) => block.state.name !== 'torch'),
        { x: 0, y: 6, z: 0, state: { name: 'torch' }, priority: 6 },
    ],
};

const site: SitePlan = {
    anchor: { x: 10, y: 64, z: 10 },
    translation: { x: 10, y: 64, z: 10 },
    rotation: 0,
    bounds: { min: { x: 10, y: 64, z: 10 }, max: { x: 11, y: 70, z: 11 } },
    clearance: [],
    access: { kind: 'none', from: null, to: { x: 10, y: 64, z: 10 }, length: 0 },
    foundationMode: 'level',
    foundationFillDepth: 0,
    foundationCutDepth: 0,
    score: 100,
    rationale: [],
};

describe('ConstructionPlanPlanner', () => {
    it('combines foundation, blueprint, and scaffold work into ordered packages', () => {
        const planner = new ConstructionPlanPlanner();
        const [plan, planError] = planner.plan(FLOATING, site, new GroundWorld(), {
            x: 0,
            y: 64,
            z: 0,
        });

        expect(planError).toBeNull();
        expect((plan?.changes.length ?? 0) > FLOATING.blocks.length).toBe(true);
        expect((plan?.scaffolds.length ?? 0) > 0).toBe(true);
        expect(plan?.phases.includes('scaffold')).toBe(true);
        expect(plan?.phases.includes('scaffold-removal')).toBe(true);
        expect(
            plan?.scaffolds.every((scaffold) => scaffold.removalPhase === 'scaffold-removal'),
        ).toBe(true);
        const scaffold = plan?.scaffolds[0];
        const scaffoldKey =
            scaffold === undefined ? '' : BlueprintIr.positionKey(scaffold.position);
        const floatingKey = BlueprintIr.positionKey({ x: 10, y: 70, z: 10 });
        const order = plan?.order ?? [];
        expect(order.indexOf(scaffoldKey) < order.indexOf(floatingKey)).toBe(true);
    });

    it('covers every change exactly once across work packages', () => {
        const planner = new ConstructionPlanPlanner();
        const [plan, planError] = planner.plan(FLOATING, site, new GroundWorld(), {
            x: 0,
            y: 64,
            z: 0,
        });

        expect(planError).toBeNull();
        const keys = plan?.workPackages.flatMap((workPackage) => workPackage.blockKeys) ?? [];
        expect(keys).toHaveLength(plan?.changes.length ?? -1);
        expect(new Set(keys).size).toBe(keys.length);
        expect(plan?.workPackages.every((workPackage) => workPackage.status === 'planned')).toBe(
            true,
        );
    });

    it('fails closed when a change position is duplicated', () => {
        const duplicated: Blueprint = {
            ...BLUEPRINT,
            blocks: [
                ...BLUEPRINT.blocks,
                { x: 0, y: 0, z: 0, state: { name: 'oak_planks' }, priority: 0 },
            ],
        };
        const planner = new ConstructionPlanPlanner();
        const [, planError] = planner.plan(duplicated, site, new GroundWorld(), {
            x: 0,
            y: 64,
            z: 0,
        });

        expect(planError?.type).toBe('INVALID_CONSTRUCTION_PLAN');
    });
});

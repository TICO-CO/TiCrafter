import { describe, expect, it } from 'bun:test';

import type { ConstructionPlan } from './construction-types.js';
import { RollbackPlanPlanner, type RollbackPlanRecord } from './rollback-plan-planner.js';

const basePlan: ConstructionPlan = {
    id: 'plan-home',
    blueprintId: 'blueprint-home',
    anchor: { x: 0, y: 64, z: 0 },
    rotation: 0,
    translation: { x: 0, y: 64, z: 0 },
    site: {
        anchor: { x: 0, y: 64, z: 0 },
        translation: { x: 0, y: 64, z: 0 },
        rotation: 0,
        bounds: { min: { x: 0, y: 64, z: 0 }, max: { x: 1, y: 65, z: 0 } },
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
    changes: [
        {
            kind: 'place',
            block: { x: 0, y: 64, z: 0, state: { name: 'cobblestone' }, priority: 0 },
            phase: 'foundation',
            reason: 'blueprint',
            dependsOn: [],
        },
        {
            kind: 'place',
            block: { x: 0, y: 65, z: 0, state: { name: 'oak_planks' }, priority: 1 },
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

describe('RollbackPlanPlanner', () => {
    it('restores original blocks and removes newly placed blocks top-down', () => {
        const records: readonly RollbackPlanRecord[] = [
            {
                position: { x: 0, y: 64, z: 0 },
                before: { name: 'grass_block' },
                after: { name: 'cobblestone' },
            },
            {
                position: { x: 0, y: 65, z: 0 },
                before: null,
                after: { name: 'oak_planks' },
            },
        ];
        const [plan, error] = new RollbackPlanPlanner({ planId: 'plan-home:rollback' }).plan(
            basePlan,
            records,
        );
        expect(error).toBeNull();
        expect(plan?.id).toBe('plan-home:rollback');
        expect(plan?.changes.map((change) => `${change.kind}:${change.block.state.name}`)).toEqual([
            'break:oak_planks',
            'break:cobblestone',
            'place:grass_block',
        ]);
        expect(plan?.materials).toEqual([{ item: 'grass_block', count: 1 }]);
    });

    it('skips positions already restored to the original state', () => {
        const records: readonly RollbackPlanRecord[] = [
            {
                position: { x: 0, y: 64, z: 0 },
                before: { name: 'grass_block' },
                after: { name: 'grass_block' },
            },
        ];
        const [plan, error] = new RollbackPlanPlanner().plan(basePlan, records);
        expect(plan).toBeNull();
        expect(error?.type).toBe('INVALID_CONSTRUCTION_PLAN');
    });

    it('uses the first before state when a position changed multiple times', () => {
        const records: readonly RollbackPlanRecord[] = [
            {
                position: { x: 0, y: 64, z: 0 },
                before: { name: 'grass_block' },
                after: { name: 'cobblestone' },
            },
            {
                position: { x: 0, y: 64, z: 0 },
                before: { name: 'cobblestone' },
                after: { name: 'stone_bricks' },
            },
        ];
        const [plan, error] = new RollbackPlanPlanner().plan(basePlan, records);
        expect(error).toBeNull();
        expect(plan?.changes[0]).toMatchObject({
            kind: 'break',
            block: { state: { name: 'stone_bricks' } },
        });
        expect(plan?.changes[1]).toMatchObject({
            kind: 'place',
            block: { state: { name: 'grass_block' } },
        });
    });
});

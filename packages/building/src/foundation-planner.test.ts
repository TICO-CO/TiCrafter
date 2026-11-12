import type { Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Blueprint, BlueprintBoundingBox } from './blueprint-ir.js';
import { BlueprintIr } from './blueprint-ir.js';
import type { SitePlan } from './construction-types.js';
import type { BuildingFailure } from './failures.js';
import { FoundationPlanner } from './foundation-planner.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';

class GridWorld implements WorldBlockQueryPort {
    constructor(
        private readonly heights: ReadonlyMap<string, number>,
        private readonly blocks: ReadonlyMap<string, string> = new Map(),
    ) {}

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        const block = this.blocks.get(BlueprintIr.positionKey(position));
        if (block !== undefined) return [{ name: block }, null];
        const height = this.heights.get(`${position.x},${position.z}`) ?? 63;
        if (position.y > height) return [null, null];
        return [{ name: 'stone' }, null];
    }
}

const BLUEPRINT: Blueprint = {
    id: 'blueprint.foundation',
    anchor: { x: 0, y: 0, z: 0 },
    rotation: 0,
    blocks: [
        { x: 0, y: 0, z: 0, state: { name: 'oak_planks' }, priority: 0 },
        { x: 1, y: 0, z: 0, state: { name: 'oak_planks' }, priority: 0 },
        { x: 0, y: 0, z: 1, state: { name: 'oak_planks' }, priority: 0 },
        { x: 1, y: 0, z: 1, state: { name: 'oak_planks' }, priority: 0 },
    ],
    materials: [{ item: 'oak_planks', count: 4 }],
    constraints: [],
};

const site = (clearance: readonly Vec3[] = []): SitePlan => {
    const bounds: BlueprintBoundingBox = {
        min: { x: 10, y: 64, z: 10 },
        max: { x: 11, y: 64, z: 11 },
    };
    return {
        anchor: { x: 10, y: 64, z: 10 },
        translation: { x: 10, y: 64, z: 10 },
        rotation: 0,
        bounds,
        clearance,
        access: { kind: 'none', from: null, to: { x: 10, y: 64, z: 10 }, length: 0 },
        foundationMode: 'terrace',
        foundationFillDepth: 1,
        foundationCutDepth: 0,
        score: 100,
        rationale: [],
    };
};

describe('FoundationPlanner', () => {
    it('fills gaps below the target level without touching blueprint positions', () => {
        const heights = new Map([['10,10', 62]]);
        const planner = new FoundationPlanner();
        const [foundation, foundationError] = planner.plan(
            BLUEPRINT,
            site(),
            new GridWorld(heights),
        );

        expect(foundationError).toBeNull();
        expect(foundation?.mode).toBe('terrace');
        expect(foundation?.maximumFillDepth).toBe(1);
        expect(foundation?.changes).toHaveLength(1);
        expect(foundation?.changes[0]).toMatchObject({
            kind: 'place',
            block: { x: 10, y: 63, z: 10, state: { name: 'cobblestone' } },
            phase: 'foundation',
        });
        const blueprintKeys = new Set(
            BLUEPRINT.blocks.map((block) =>
                BlueprintIr.positionKey({
                    x: block.x + 10,
                    y: block.y + 64,
                    z: block.z + 10,
                }),
            ),
        );
        expect(
            foundation?.changes.some((change) =>
                blueprintKeys.has(
                    BlueprintIr.positionKey({
                        x: change.block.x,
                        y: change.block.y,
                        z: change.block.z,
                    }),
                ),
            ),
        ).toBe(false);
    });

    it('removes clearance obstacles recorded by the site plan', () => {
        const obstacle = { x: 10, y: 65, z: 10 };
        const blocks = new Map([[BlueprintIr.positionKey(obstacle), 'oak_log']]);
        const planner = new FoundationPlanner();
        const [foundation, foundationError] = planner.plan(
            BLUEPRINT,
            site([obstacle]),
            new GridWorld(new Map(), blocks),
        );

        expect(foundationError).toBeNull();
        expect(
            foundation?.changes.some(
                (change) =>
                    change.kind === 'break' &&
                    BlueprintIr.blockKey(change.block) === BlueprintIr.positionKey(obstacle) &&
                    change.block.state.name === 'oak_log',
            ),
        ).toBe(true);
    });

    it('rejects foundations deeper than the configured maximum', () => {
        const planner = new FoundationPlanner({ maximumDepth: 1 });
        const [foundation, foundationError] = planner.plan(
            BLUEPRINT,
            site(),
            new GridWorld(new Map([['10,10', 60]])),
        );

        expect(foundation).toBeNull();
        expect(foundationError?.type).toBe('FOUNDATION_FAILED');
    });
});

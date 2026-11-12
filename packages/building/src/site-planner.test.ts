import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Blueprint, BlueprintBoundingBox } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';
import type { SiteConstraintPort } from './site-evaluator.js';
import { SitePlanner } from './site-planner.js';

class TerrainWorld implements WorldBlockQueryPort {
    constructor(private readonly groundHeight: (x: number, z: number) => number) {}

    blockAt(position: {
        x: number;
        y: number;
        z: number;
    }): Result<WorldBlockState | null, BuildingFailure> {
        const height = this.groundHeight(position.x, position.z);
        if (position.y > height) return [null, null];
        return [{ name: 'stone' }, null];
    }
}

class LiquidWorld implements WorldBlockQueryPort {
    blockAt(): Result<WorldBlockState | null, BuildingFailure> {
        return [{ name: 'water' }, null];
    }
}

class ProtectedRules implements SiteConstraintPort {
    isProtected(): Result<boolean, BuildingFailure> {
        return [true, null];
    }

    intersectsActiveStructure(_bounds: BlueprintBoundingBox): Result<boolean, BuildingFailure> {
        return [false, null];
    }
}

const BLUEPRINT: Blueprint = {
    id: 'blueprint.site',
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

describe('SitePlanner', () => {
    it('selects the requested flat site and levels the foundation', () => {
        const planner = new SitePlanner({ world: new TerrainWorld(() => 63) });
        const [site, siteError] = planner.plan(
            BLUEPRINT,
            { x: 10, y: 64, z: 10 },
            { requestedAnchor: { x: 10, y: 64, z: 10 }, candidateRadius: 0 },
        );

        expect(siteError).toBeNull();
        expect(site?.anchor).toEqual({ x: 10, y: 64, z: 10 });
        expect(site?.translation).toEqual({ x: 10, y: 64, z: 10 });
        expect(site?.foundationMode).toBe('level');
        expect(site?.foundationFillDepth).toBe(0);
    });

    it('prefers a flat site over a closer sloped site', () => {
        const planner = new SitePlanner({
            world: new TerrainWorld((x) => (x === 11 ? 66 : 63)),
        });
        const [site, siteError] = planner.plan(
            BLUEPRINT,
            { x: 10, y: 64, z: 10 },
            { requestedAnchor: { x: 10, y: 64, z: 10 }, candidateRadius: 4, maximumSlope: 3 },
        );

        expect(siteError).toBeNull();
        expect(site?.anchor.x).toBe(8);
    });

    it('rejects water in the footprint', () => {
        const planner = new SitePlanner({ world: new LiquidWorld() });
        const [site, siteError] = planner.plan(
            BLUEPRINT,
            { x: 10, y: 64, z: 10 },
            { requestedAnchor: { x: 10, y: 64, z: 10 }, candidateRadius: 0 },
        );

        expect(site).toBeNull();
        expect(siteError?.type).toBe('SITE_REJECTED');
    });

    it('rejects slopes above the configured maximum', () => {
        const planner = new SitePlanner({ world: new TerrainWorld((x) => 63 + x) });
        const [site, siteError] = planner.plan(
            BLUEPRINT,
            { x: 10, y: 74, z: 10 },
            {
                requestedAnchor: { x: 10, y: 74, z: 10 },
                candidateRadius: 0,
                maximumSlope: 0,
            },
        );

        expect(site).toBeNull();
        expect(siteError?.type).toBe('SITE_REJECTED');
    });

    it('rejects protected footprints', () => {
        const planner = new SitePlanner({
            world: new TerrainWorld(() => 63),
            constraints: new ProtectedRules(),
        });
        const [site, siteError] = planner.plan(
            BLUEPRINT,
            { x: 10, y: 64, z: 10 },
            { requestedAnchor: { x: 10, y: 64, z: 10 }, candidateRadius: 0 },
        );

        expect(site).toBeNull();
        expect(siteError?.type).toBe('SITE_REJECTED');
    });
});

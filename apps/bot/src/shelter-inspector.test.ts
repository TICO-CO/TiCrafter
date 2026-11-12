import type { Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { type HomeInspectionBounds, ShelterInspector } from './shelter-inspector.js';
import type { BlockSnapshot, WorldCacheAdapter } from './world-cache.js';

const HOME: HomeInspectionBounds = {
    min: { x: 0, y: 64, z: 0 },
    max: { x: 2, y: 66, z: 2 },
};

const SHELTER_BLOCKS: BlockSnapshot[] = [
    { name: 'oak_planks', position: { x: 0, y: 65, z: 0 } },
    { name: 'oak_planks', position: { x: 2, y: 65, z: 0 } },
    { name: 'oak_planks', position: { x: 0, y: 65, z: 2 } },
    { name: 'oak_planks', position: { x: 2, y: 65, z: 2 } },
    { name: 'oak_planks', position: { x: 1, y: 66, z: 1 } },
];

class FakeWorld {
    constructor(
        private readonly blocks: readonly BlockSnapshot[],
        private readonly blockName: string | null = 'stone',
    ) {}

    blocksInBox(): readonly BlockSnapshot[] {
        return this.blocks;
    }

    blockAt(): string | null {
        return this.blockName;
    }
}

function inspect(position: Vec3, home: HomeInspectionBounds | null = HOME) {
    const world = new FakeWorld(SHELTER_BLOCKS) as unknown as WorldCacheAdapter;
    return ShelterInspector.inspect(world, position, home);
}

describe('shelter inspector', () => {
    it('reports shelter while the bot is at home', () => {
        const inspection = inspect({ x: 1, y: 64, z: 1 });
        expect(inspection.isSheltered).toBe(true);
    });

    it('does not report shelter when the bot is far from home', () => {
        const inspection = inspect({ x: 40, y: 64, z: 0 });
        expect(inspection.isSheltered).toBe(false);
    });

    it('tracks the home bbox with a one-block padding', () => {
        expect(ShelterInspector.contains({ x: -1, y: 64, z: 1 }, HOME, 1)).toBe(true);
        expect(ShelterInspector.contains({ x: -2, y: 64, z: 1 }, HOME, 1)).toBe(false);
    });

    it('finds a dig site beside the bot', () => {
        const world = new FakeWorld([], 'dirt') as unknown as WorldCacheAdapter;
        const site = ShelterInspector.findDigSite(world, { x: 10, y: 64, z: 10 });
        expect(site).toEqual({ x: 11, y: 64, z: 10 });
    });
});

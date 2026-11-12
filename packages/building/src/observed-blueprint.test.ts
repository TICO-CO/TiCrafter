import type { Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { BlueprintBoundingBox } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import { ObservedBlueprintCapture } from './observed-blueprint.js';
import type {
    PositionedWorldBlock,
    WorldBlockQueryPort,
    WorldBlockState,
} from './schematic-diff.js';

class FakeWorld implements WorldBlockQueryPort {
    blocksInBox?: (
        bounds: BlueprintBoundingBox,
    ) => Result<readonly PositionedWorldBlock[], BuildingFailure>;

    constructor(
        private readonly blocks: readonly PositionedWorldBlock[],
        supportBoxQuery = true,
    ) {
        if (supportBoxQuery) this.blocksInBox = () => [this.blocks, null];
    }

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        return [
            this.blocks.find(
                (block) =>
                    block.position.x === position.x &&
                    block.position.y === position.y &&
                    block.position.z === position.z,
            ) ?? null,
            null,
        ];
    }
}

const bounds: BlueprintBoundingBox = {
    min: { x: 10, y: 64, z: 20 },
    max: { x: 11, y: 65, z: 21 },
};

describe('ObservedBlueprintCapture', () => {
    it('captures solid blocks from the queried box', () => {
        const world = new FakeWorld([
            { position: { x: 10, y: 64, z: 20 }, name: 'cobblestone' },
            { position: { x: 11, y: 64, z: 20 }, name: 'oak_planks' },
            { position: { x: 10, y: 64, z: 21 }, name: 'air' },
        ]);
        const capture = new ObservedBlueprintCapture({ world });

        const [blueprint, error] = capture.capture({ id: 'observed.house', bounds });

        expect(error).toBeNull();
        expect(blueprint?.anchor).toEqual(bounds.min);
        expect(blueprint?.blocks).toHaveLength(2);
        expect(blueprint?.materials).toEqual([
            { item: 'cobblestone', count: 1 },
            { item: 'oak_planks', count: 1 },
        ]);
    });

    it('scans with blockAt when the box query is unavailable', () => {
        const world = new FakeWorld([{ position: { x: 10, y: 64, z: 20 }, name: 'stone' }], false);
        const capture = new ObservedBlueprintCapture({ world });

        const [blueprint, error] = capture.capture({ id: 'observed.scan', bounds });

        expect(error).toBeNull();
        expect(blueprint?.blocks).toHaveLength(1);
    });

    it('rejects an empty region', () => {
        const world = new FakeWorld([]);
        const capture = new ObservedBlueprintCapture({ world });

        const [blueprint, error] = capture.capture({ id: 'observed.empty', bounds });

        expect(blueprint).toBeNull();
        expect(error?.type).toBe('OBSERVATION_FAILED');
    });
});

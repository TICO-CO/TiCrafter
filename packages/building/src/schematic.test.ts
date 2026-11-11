import type { Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Blueprint, BlueprintBoundingBox } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type {
    PositionedWorldBlock,
    WorldBlockQueryPort,
    WorldBlockState,
} from './schematic-diff.js';
import { SchematicDiffCalculator } from './schematic-diff.js';
import {
    type DecodedSchematic,
    type DecodedSchematicBlock,
    type SchematicDecoderPort,
    SchematicParser,
} from './schematic-parser.js';

class FakeDecoder implements SchematicDecoderPort {
    constructor(private readonly blocks: readonly DecodedSchematicBlock[]) {}

    async decode(): Promise<Result<DecodedSchematic, BuildingFailure>> {
        return [{ size: { x: 2, y: 2, z: 2 }, blocks: this.blocks }, null];
    }
}

class FakeWorld implements WorldBlockQueryPort {
    private readonly blocks = new Map<string, WorldBlockState>();

    constructor(blocks: Readonly<Record<string, string>> = {}) {
        Object.entries(blocks).forEach(([key, name]) => {
            this.blocks.set(key, { name });
        });
    }

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        return [this.blocks.get(FakeWorld.key(position)) ?? null, null];
    }

    blocksInBox(
        bounds: BlueprintBoundingBox,
    ): Result<readonly PositionedWorldBlock[], BuildingFailure> {
        const blocks = [...this.blocks.entries()].map(([key, state]) => ({
            ...state,
            position: FakeWorld.position(key),
        }));
        return [
            blocks.filter(
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

    set(position: Vec3, name: string): void {
        this.blocks.set(FakeWorld.key(position), { name });
    }

    private static key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }

    private static position(key: string): Vec3 {
        const [x, y, z] = key.split(',').map((part) => Number(part));
        return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
    }
}

const DIFF_BLUEPRINT: Blueprint = {
    id: 'schematic.diff',
    anchor: { x: 0, y: 0, z: 0 },
    rotation: 0,
    blocks: [
        { x: 0, y: 0, z: 0, state: { name: 'stone' }, priority: 0 },
        { x: 0, y: 1, z: 0, state: { name: 'oak_planks' }, priority: 1 },
        { x: 2, y: 0, z: 0, state: { name: 'cobblestone' }, priority: 0 },
    ],
    materials: [
        { item: 'cobblestone', count: 1 },
        { item: 'oak_planks', count: 1 },
        { item: 'stone', count: 1 },
    ],
    constraints: [],
};

describe('SchematicParser', () => {
    it('parses decoded blocks into a blueprint', async () => {
        const parser = new SchematicParser(
            new FakeDecoder([
                { x: 0, y: 0, z: 0, stateName: 'stone' },
                { x: 0, y: 1, z: 0, stateName: 'oak_planks', properties: { axis: 'y' } },
            ]),
        );

        const [blueprint, parseError] = await parser.parse(Buffer.from('schematic'), {
            id: 'schematic.house',
            anchor: { x: 10, y: 64, z: -5 },
        });

        expect(parseError).toBeNull();
        expect(blueprint?.blocks).toHaveLength(2);
        expect(blueprint?.blocks[0]).toMatchObject({ x: 10, y: 64, z: -5 });
        expect(blueprint?.blocks[1]?.state.properties).toEqual({ axis: 'y' });
    });

    it('rejects litematic input', async () => {
        const parser = new SchematicParser(new FakeDecoder([]));
        const [blueprint, parseError] = await parser.parse(Buffer.from('schematic'), {
            id: 'schematic.litematic',
            anchor: { x: 0, y: 0, z: 0 },
            format: 'litematic',
        });

        expect(blueprint).toBeNull();
        expect(parseError?.type).toBe('UNSUPPORTED_FORMAT');
    });
});

describe('SchematicDiffCalculator', () => {
    it('reports satisfied and missing blocks', () => {
        const world = new FakeWorld({ '0,0,0': 'stone' });
        const calculator = new SchematicDiffCalculator();
        const [diff, diffError] = calculator.diff(DIFF_BLUEPRINT, world);

        expect(diffError).toBeNull();
        expect(diff?.satisfied).toHaveLength(1);
        expect(diff?.missing).toHaveLength(2);
        expect(diff?.missing[0]?.state.name).toBe('oak_planks');
    });

    it('reports mismatched and extra blocks', () => {
        const world = new FakeWorld({
            '0,0,0': 'dirt',
            '0,1,0': 'oak_planks',
            '2,0,0': 'cobblestone',
            '1,0,0': 'cobblestone',
        });
        const calculator = new SchematicDiffCalculator();
        const [diff, diffError] = calculator.diff(DIFF_BLUEPRINT, world);

        expect(diffError).toBeNull();
        expect(diff?.mismatched).toHaveLength(1);
        expect(diff?.extra).toEqual([{ x: 1, y: 0, z: 0 }]);
        expect(diff?.satisfied).toHaveLength(2);
    });

    it('is idempotent when the world already matches', () => {
        const world = new FakeWorld({
            '0,0,0': 'stone',
            '0,1,0': 'oak_planks',
            '2,0,0': 'cobblestone',
        });
        const calculator = new SchematicDiffCalculator();
        const [diff, diffError] = calculator.diff(DIFF_BLUEPRINT, world);

        expect(diffError).toBeNull();
        expect(diff?.missing).toHaveLength(0);
        expect(diff?.mismatched).toHaveLength(0);
        expect(diff?.satisfied).toHaveLength(3);
    });
});

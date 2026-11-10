import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { MineflayerPerceptionSource } from './perception-source.js';

interface FakeBlock {
    name: string;
    boundingBox: string;
    getProperties: () => Record<string, string>;
}

const stone: FakeBlock = {
    name: 'stone',
    boundingBox: 'block',
    getProperties: () => ({}),
};
const water: FakeBlock = {
    name: 'water',
    boundingBox: 'empty',
    getProperties: () => ({ level: '0' }),
};

const bot = {
    entity: { position: { x: 8, y: 64, z: 8 } },
    world: {
        getColumns: () => [
            {
                chunkX: '0',
                chunkZ: '0',
                column: {
                    minY: 64,
                    worldHeight: 1,
                    getBlock: (position: { x: number; y: number; z: number }) => {
                        if (position.x === 0 && position.z === 0) return stone;
                        if (position.x === 1 && position.z === 0) return water;
                        return null;
                    },
                },
            },
        ],
    },
} as unknown as Bot;

describe('MineflayerPerceptionSource', () => {
    it('converts loaded columns into chunk snapshots', () => {
        const source = new MineflayerPerceptionSource(bot);
        const position = source.position();
        expect(position).toEqual({ x: 8, y: 64, z: 8 });
        if (position === null) return;

        const snapshot = source.nextLoadedChunk(position, 32);

        expect(snapshot?.chunk).toEqual({ x: 0, z: 0 });
        expect((snapshot?.version ?? 0) > 0).toBe(true);
        expect(snapshot?.blocks).toEqual([
            {
                position: { x: 0, y: 64, z: 0 },
                blockId: 'stone',
                solid: true,
            },
            {
                position: { x: 1, y: 64, z: 0 },
                blockId: 'water',
                solid: false,
                properties: { level: '0' },
            },
        ]);
    });

    it('returns no snapshot when no columns are inside the ring', () => {
        const source = new MineflayerPerceptionSource(bot);

        expect(source.nextLoadedChunk({ x: 1000, y: 64, z: 1000 }, 16)).toBeNull();
    });
});

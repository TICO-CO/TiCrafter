import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { WorldCacheAdapter } from './world-cache.js';

interface FakeBlock {
    name: string;
    position: { x: number; y: number; z: number };
    getProperties: () => Record<string, string | number | boolean>;
}

function blockAtName(name: string): FakeBlock {
    return {
        name,
        position: { x: 0, y: 0, z: 0 },
        getProperties: () => ({ facing: 'north', lit: false }),
    };
}

function createBot(candidateName: string): Bot {
    const bot = {
        blockAt: (position: { x: number; y: number; z: number }) => ({
            ...blockAtName(position.y === 64 ? 'oak_planks' : 'air'),
            position,
        }),
        findBlock: (options: {
            matching: (block: { name: string }) => boolean;
            maxDistance?: number;
        }) => {
            if (!options.matching({ name: candidateName })) return null;
            return {
                name: candidateName,
                position: { x: 4, y: 64, z: 2 },
            };
        },
        registry: { blocksByName: {} },
        entities: {},
    };
    return bot as unknown as Bot;
}

describe('world cache adapter', () => {
    it('reads block state properties', () => {
        const adapter = new WorldCacheAdapter(createBot('red_bed'));
        expect(adapter.blockStateAt({ x: 0, y: 64, z: 0 })).toEqual({
            name: 'oak_planks',
            properties: { facing: 'north', lit: 'false' },
        });
    });

    it('scans bounded boxes only', () => {
        const adapter = new WorldCacheAdapter(createBot('red_bed'));
        const blocks = adapter.blocksInBox({
            min: { x: 0, y: 64, z: 0 },
            max: { x: 1, y: 64, z: 0 },
        });
        expect(blocks).toHaveLength(2);
        expect(
            adapter.blocksInBox({
                min: { x: 0, y: 0, z: 0 },
                max: { x: 100, y: 100, z: 100 },
            }),
        ).toHaveLength(0);
    });

    it('finds blocks by wildcard name', () => {
        const adapter = new WorldCacheAdapter(createBot('red_bed'));
        expect(adapter.nearestBlock(['*_bed'], 20)).toEqual({ x: 4, y: 64, z: 2 });
        expect(adapter.nearestBlock(['stone'], 20)).toBeNull();
        expect(adapter.nearestBlock([], 20)).toBeNull();
    });
});

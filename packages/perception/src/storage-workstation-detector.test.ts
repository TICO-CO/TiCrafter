import { describe, expect, it } from 'bun:test';

import { StorageWorkstationDetector } from './storage-workstation-detector.js';
import type { ChunkSnapshot, VoxelBlock } from './types.js';

function block(x: number, z: number, blockId: string, y = 64): VoxelBlock {
    return { position: { x, y, z }, blockId, solid: true };
}

const snapshot: ChunkSnapshot = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 1,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: [
        block(0, 0, 'chest'),
        block(2, 0, 'furnace'),
        block(4, 0, 'crafting_table'),
        block(1, 0, 'stone'),
    ],
};

describe('StorageWorkstationDetector', () => {
    it('detects storage and workstation clusters', () => {
        const candidates = new StorageWorkstationDetector().detect(snapshot);

        expect(candidates).toHaveLength(2);
        expect(candidates.map((candidate) => candidate.type)).toEqual(['storage', 'workstation']);
        expect(candidates[0]?.bbox).toEqual({
            min: { x: 0, y: 64, z: 0 },
            max: { x: 0, y: 64, z: 0 },
        });
        expect(candidates[1]?.bbox).toEqual({
            min: { x: 2, y: 64, z: 0 },
            max: { x: 4, y: 64, z: 0 },
        });
    });

    it('groups nearby containers into one storage cluster', () => {
        const candidates = new StorageWorkstationDetector().detect({
            ...snapshot,
            blocks: [block(0, 0, 'chest'), block(1, 0, 'barrel'), block(2, 1, 'white_shulker_box')],
        });

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.evidence).toBe(
            'storage cluster blocks 3 types barrel,chest,white_shulker_box',
        );
        expect(candidates[0]?.anchors).toHaveLength(3);
    });

    it('ignores unrelated blocks', () => {
        const candidates = new StorageWorkstationDetector().detect({
            ...snapshot,
            blocks: [block(0, 0, 'stone'), block(1, 0, 'oak_planks')],
        });

        expect(candidates).toHaveLength(0);
    });
});

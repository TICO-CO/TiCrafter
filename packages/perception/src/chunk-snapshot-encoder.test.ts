import { describe, expect, it } from 'bun:test';

import { ChunkSnapshotEncoder } from './chunk-snapshot-encoder.js';
import type { ChunkSnapshotInput, VoxelBlock } from './types.js';

const stoneBlock: VoxelBlock = {
    position: { x: 1, y: 64, z: 1 },
    blockId: 'stone',
    solid: true,
};

const input: ChunkSnapshotInput = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 3,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: [
        stoneBlock,
        { position: { x: 2, y: 64, z: 2 }, blockId: 'air', solid: false },
        { position: { x: 3, y: 64, z: 3 }, blockId: 'oak_planks', solid: true },
    ],
};

describe('ChunkSnapshotEncoder', () => {
    it('encodes a sparse snapshot without air blocks', () => {
        const [snapshot, error] = new ChunkSnapshotEncoder().encode(input);

        expect(error).toBeNull();
        if (snapshot === null) return;
        expect(snapshot.chunk).toEqual({ x: 0, z: 0 });
        expect(snapshot.version).toBe(3);
        expect(snapshot.blocks).toHaveLength(2);
    });

    it('deduplicates blocks at the same position', () => {
        const [snapshot, error] = new ChunkSnapshotEncoder().encode({
            ...input,
            blocks: [stoneBlock, { ...stoneBlock, blockId: 'cobblestone' }],
        });

        expect(error).toBeNull();
        if (snapshot === null) return;
        expect(snapshot.blocks).toHaveLength(1);
        expect(snapshot.blocks[0]?.blockId).toBe('cobblestone');
    });

    it('rejects a negative chunk version', () => {
        const [snapshot, error] = new ChunkSnapshotEncoder().encode({
            ...input,
            version: -1,
        });

        expect(snapshot).toBeNull();
        expect(error).toEqual({ type: 'INVALID_VERSION', value: -1 });
    });

    it('rejects a block outside the chunk', () => {
        const [snapshot, error] = new ChunkSnapshotEncoder().encode({
            ...input,
            blocks: [{ ...stoneBlock, position: { x: 16, y: 64, z: 1 } }],
        });

        expect(snapshot).toBeNull();
        expect(error).toEqual({
            type: 'BLOCK_OUTSIDE_CHUNK',
            position: { x: 16, y: 64, z: 1 },
            chunk: { x: 0, z: 0 },
        });
    });
});

import { describe, expect, it } from 'bun:test';

import { InMemoryChunkStore } from './chunk-version-store.js';
import { SparseOccupancyGrid } from './occupancy-grid.js';
import type { StoredChunk } from './types.js';

const chunk: StoredChunk = {
    chunk: { x: 0, z: 0 },
    version: 1,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: [
        {
            position: { x: 1, y: 64, z: 1 },
            blockId: 'stone',
            solid: true,
        },
    ],
};

describe('SparseOccupancyGrid', () => {
    it('returns blocks from stored chunks', () => {
        const store = new InMemoryChunkStore();
        store.save(chunk);
        const grid = new SparseOccupancyGrid(store);

        const [block, error] = grid.blockAt({ x: 1, y: 64, z: 1 });

        expect(error).toBeNull();
        expect(block?.blockId).toBe('stone');
        expect(grid.isOccupied({ x: 1, y: 64, z: 1 })[0]).toBe(true);
        expect(grid.isSolid({ x: 1, y: 64, z: 1 })[0]).toBe(true);
    });

    it('treats absent blocks as empty', () => {
        const grid = new SparseOccupancyGrid(new InMemoryChunkStore());

        const [block, error] = grid.blockAt({ x: 0, y: 64, z: 0 });

        expect(error).toBeNull();
        expect(block).toBeNull();
        expect(grid.isOccupied({ x: 0, y: 64, z: 0 })[0]).toBe(false);
    });

    it('refreshes after invalidation', () => {
        const store = new InMemoryChunkStore();
        const grid = new SparseOccupancyGrid(store);
        expect(grid.blockAt({ x: 1, y: 64, z: 1 })[0]).toBeNull();

        store.save(chunk);
        grid.invalidate();

        expect(grid.blockAt({ x: 1, y: 64, z: 1 })[0]?.blockId).toBe('stone');
    });
});

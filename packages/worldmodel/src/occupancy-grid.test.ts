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

    it('updates loaded chunks without reloading the store', () => {
        const store = new InMemoryChunkStore();
        store.save(chunk);
        let listCalls = 0;
        const grid = new SparseOccupancyGrid({
            get: (coordinate) => store.get(coordinate),
            list: () => {
                listCalls += 1;
                return store.list();
            },
            save: (value) => store.save(value),
        });

        expect(grid.blockAt({ x: 1, y: 64, z: 1 })[0]?.blockId).toBe('stone');
        expect(listCalls).toBe(1);

        grid.applyBlock({ position: { x: 2, y: 64, z: 1 }, blockId: 'dirt', solid: true });
        grid.applyBlock({ position: { x: 1, y: 64, z: 1 }, blockId: 'air', solid: false });

        expect(grid.blockAt({ x: 2, y: 64, z: 1 })[0]?.blockId).toBe('dirt');
        expect(grid.blockAt({ x: 1, y: 64, z: 1 })[0]).toBeNull();
        expect(listCalls).toBe(1);

        grid.replaceChunk({ x: 0, z: 0 }, [
            { position: { x: 3, y: 64, z: 3 }, blockId: 'sand', solid: true },
        ]);

        expect(grid.blockAt({ x: 2, y: 64, z: 1 })[0]).toBeNull();
        expect(grid.blockAt({ x: 3, y: 64, z: 3 })[0]?.blockId).toBe('sand');
        expect(listCalls).toBe(1);
    });
});

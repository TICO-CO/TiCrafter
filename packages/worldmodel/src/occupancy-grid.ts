import type { Result } from '@ticrafter/core';

import type { ChunkStorePort } from './chunk-version-store.js';
import type { BlockPosition, ChunkBlockObservation, WorldFailure } from './types.js';

export class SparseOccupancyGrid {
    private blocks: Map<string, ChunkBlockObservation> | null = null;

    constructor(private readonly chunks: ChunkStorePort) {}

    blockAt(position: BlockPosition): Result<ChunkBlockObservation | null, WorldFailure> {
        const [loaded, loadError] = this.ensureLoaded();
        if (loadError) return [null, loadError];
        if (loaded === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'occupancy grid returned null' }];
        }
        return [loaded.get(SparseOccupancyGrid.key(position)) ?? null, null];
    }

    isOccupied(position: BlockPosition): Result<boolean, WorldFailure> {
        const [block, blockError] = this.blockAt(position);
        if (blockError) return [null, blockError];
        return [block !== null, null];
    }

    isSolid(position: BlockPosition): Result<boolean, WorldFailure> {
        const [block, blockError] = this.blockAt(position);
        if (blockError) return [null, blockError];
        return [block?.solid ?? false, null];
    }

    invalidate(): void {
        this.blocks = null;
    }

    private ensureLoaded(): Result<Map<string, ChunkBlockObservation> | null, WorldFailure> {
        if (this.blocks !== null) return [this.blocks, null];
        const [chunks, listError] = this.chunks.list();
        if (listError) return [null, listError];
        if (chunks === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'chunk list returned null' }];
        }
        const blocks = new Map<string, ChunkBlockObservation>();
        chunks.forEach((chunk) => {
            chunk.blocks.forEach((block) => {
                blocks.set(SparseOccupancyGrid.key(block.position), block);
            });
        });
        this.blocks = blocks;
        return [blocks, null];
    }

    private static key(position: BlockPosition): string {
        return `${position.x}:${position.y}:${position.z}`;
    }
}

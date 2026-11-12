import type { Result } from '@ticrafter/core';

import type { ChunkStorePort } from './chunk-version-store.js';
import { WorldFailures } from './failures.js';
import type { BlockPosition, BoundingBox, ChunkBlockObservation, WorldFailure } from './types.js';

export class SparseOccupancyGrid {
    private blocks: Map<string, ChunkBlockObservation> | null = null;

    constructor(private readonly chunks: ChunkStorePort) {}

    blockAt(position: BlockPosition): Result<ChunkBlockObservation | null, WorldFailure> {
        const [loaded, loadError] = this.ensureLoaded();
        if (loadError) return [null, loadError];
        if (loaded === null) {
            return [null, WorldFailures.storageFailed('occupancy grid returned null')];
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

    blocksInBox(bounds: BoundingBox): Result<readonly ChunkBlockObservation[], WorldFailure> {
        const [loaded, loadError] = this.ensureLoaded();
        if (loadError) return [null, loadError];
        if (loaded === null) {
            return [null, WorldFailures.storageFailed('occupancy grid returned null')];
        }
        const blocks = [...loaded.values()].filter((block) =>
            SparseOccupancyGrid.inside(bounds, block.position),
        );
        return [blocks, null];
    }

    invalidate(): void {
        this.blocks = null;
    }

    private ensureLoaded(): Result<Map<string, ChunkBlockObservation> | null, WorldFailure> {
        if (this.blocks !== null) return [this.blocks, null];
        const [chunks, listError] = this.chunks.list();
        if (listError) return [null, listError];
        if (chunks === null) {
            return [null, WorldFailures.storageFailed('chunk list returned null')];
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

    private static inside(bounds: BoundingBox, position: BlockPosition): boolean {
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
        );
    }
}

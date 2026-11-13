import type { Result } from '@ticrafter/core';

import type { ChunkStorePort } from './chunk-version-store.js';
import { WorldFailures } from './failures.js';
import type {
    BlockPosition,
    BoundingBox,
    ChunkBlockObservation,
    ChunkCoordinate,
    WorldFailure,
} from './types.js';

const AIR_BLOCK_IDS = new Set(['air', 'cave_air', 'void_air']);

export class SparseOccupancyGrid {
    private blocks: Map<string, ChunkBlockObservation> | null = null;
    private chunkIndex: Map<string, Set<string>> | null = null;

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
        if (loaded === null || this.chunkIndex === null) {
            return [null, WorldFailures.storageFailed('occupancy grid returned null')];
        }
        const blocks: ChunkBlockObservation[] = [];
        const minimumChunkX = Math.floor(bounds.min.x / 16);
        const maximumChunkX = Math.floor(bounds.max.x / 16);
        const minimumChunkZ = Math.floor(bounds.min.z / 16);
        const maximumChunkZ = Math.floor(bounds.max.z / 16);
        for (let x = minimumChunkX; x <= maximumChunkX; x += 1) {
            for (let z = minimumChunkZ; z <= maximumChunkZ; z += 1) {
                const keys = this.chunkIndex.get(SparseOccupancyGrid.chunkKey(x, z));
                keys?.forEach((key) => {
                    const block = loaded.get(key);
                    if (block !== undefined && SparseOccupancyGrid.inside(bounds, block.position)) {
                        blocks.push(block);
                    }
                });
            }
        }
        return [blocks, null];
    }

    replaceChunk(chunk: ChunkCoordinate, blocks: readonly ChunkBlockObservation[]): void {
        if (this.blocks === null || this.chunkIndex === null) return;
        const key = SparseOccupancyGrid.chunkKey(chunk.x, chunk.z);
        this.removeChunk(key);
        const blockKeys = new Set<string>();
        blocks.forEach((block) => {
            const blockKey = SparseOccupancyGrid.key(block.position);
            this.blocks?.set(blockKey, block);
            blockKeys.add(blockKey);
        });
        this.chunkIndex.set(key, blockKeys);
    }

    applyBlock(block: ChunkBlockObservation): void {
        if (this.blocks === null || this.chunkIndex === null) return;
        const blockKey = SparseOccupancyGrid.key(block.position);
        const chunkKey = SparseOccupancyGrid.chunkKeyForPosition(block.position);
        if (AIR_BLOCK_IDS.has(block.blockId)) {
            this.blocks.delete(blockKey);
            this.chunkIndex.get(chunkKey)?.delete(blockKey);
            return;
        }
        this.blocks.set(blockKey, block);
        const existing = this.chunkIndex.get(chunkKey);
        if (existing === undefined) {
            this.chunkIndex.set(chunkKey, new Set([blockKey]));
            return;
        }
        existing.add(blockKey);
    }

    invalidate(): void {
        this.blocks = null;
        this.chunkIndex = null;
    }

    private removeChunk(key: string): void {
        const blockKeys = this.chunkIndex?.get(key);
        if (blockKeys === undefined) return;
        blockKeys.forEach((blockKey) => this.blocks?.delete(blockKey));
        this.chunkIndex?.delete(key);
    }

    private ensureLoaded(): Result<Map<string, ChunkBlockObservation> | null, WorldFailure> {
        if (this.blocks !== null) return [this.blocks, null];
        const [chunks, listError] = this.chunks.list();
        if (listError) return [null, listError];
        if (chunks === null) {
            return [null, WorldFailures.storageFailed('chunk list returned null')];
        }
        const blocks = new Map<string, ChunkBlockObservation>();
        const chunkIndex = new Map<string, Set<string>>();
        chunks.forEach((chunk) => {
            const chunkKey = SparseOccupancyGrid.chunkKey(chunk.chunk.x, chunk.chunk.z);
            const blockKeys = new Set<string>();
            chunk.blocks.forEach((block) => {
                const blockKey = SparseOccupancyGrid.key(block.position);
                blocks.set(blockKey, block);
                blockKeys.add(blockKey);
            });
            chunkIndex.set(chunkKey, blockKeys);
        });
        this.blocks = blocks;
        this.chunkIndex = chunkIndex;
        return [blocks, null];
    }

    private static key(position: BlockPosition): string {
        return `${position.x}:${position.y}:${position.z}`;
    }

    private static chunkKeyForPosition(position: BlockPosition): string {
        return SparseOccupancyGrid.chunkKey(
            Math.floor(position.x / 16),
            Math.floor(position.z / 16),
        );
    }

    private static chunkKey(x: number, z: number): string {
        return `${x}:${z}`;
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

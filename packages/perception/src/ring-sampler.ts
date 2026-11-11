import type { Result } from '@ticrafter/core';

import { PerceptionFailures } from './failures.js';
import type { PerceptionRateLimiter } from './perception-rate-limiter.js';
import type {
    ChunkCoordinate,
    ChunkSnapshotInput,
    PerceptionFailure,
    VoxelBlock,
    VoxelPosition,
} from './types.js';

export interface RingSamplerOptions {
    ringRadius: number;
}

export interface LoadedChunkSnapshot {
    chunk: ChunkCoordinate;
    version: number;
    observedAt: string;
    blocks: readonly VoxelBlock[];
}

export interface RingSampleRequest {
    botId: string;
    position: VoxelPosition;
    loadedChunks: readonly LoadedChunkSnapshot[];
}

interface RankedChunk {
    loaded: LoadedChunkSnapshot;
    distance: number;
}

export class RingSampler {
    static create(
        options: RingSamplerOptions,
        rateLimiter: PerceptionRateLimiter,
    ): Result<RingSampler, PerceptionFailure> {
        if (
            !Number.isInteger(options.ringRadius) ||
            options.ringRadius < 16 ||
            options.ringRadius > 64
        ) {
            return [null, PerceptionFailures.invalidRingRadius(options.ringRadius)];
        }
        return [new RingSampler(options.ringRadius, rateLimiter), null];
    }

    private constructor(
        private readonly ringRadius: number,
        private readonly rateLimiter: PerceptionRateLimiter,
    ) {}

    sample(request: RingSampleRequest): Result<readonly ChunkSnapshotInput[], PerceptionFailure> {
        const { position } = request;
        if (!RingSampler.isPosition(position)) {
            return [null, PerceptionFailures.invalidBlockPosition(position)];
        }
        const chunks = RingSampler.rankedChunks(request.loadedChunks, position, this.ringRadius);
        const sampled: ChunkSnapshotInput[] = [];
        for (const ranked of chunks) {
            if (!this.rateLimiter.tryAcquire(request.botId)) break;
            sampled.push({
                botId: request.botId,
                chunk: ranked.loaded.chunk,
                version: ranked.loaded.version,
                observedAt: ranked.loaded.observedAt,
                blocks: ranked.loaded.blocks,
            });
        }
        return [sampled, null];
    }

    private static rankedChunks(
        loadedChunks: readonly LoadedChunkSnapshot[],
        position: VoxelPosition,
        ringRadius: number,
    ): readonly RankedChunk[] {
        return loadedChunks
            .map((loaded) => ({ loaded, distance: RingSampler.distance(loaded.chunk, position) }))
            .filter((ranked) => ranked.distance <= ringRadius)
            .sort((left, right) => RingSampler.compare(left, right));
    }

    private static compare(left: RankedChunk, right: RankedChunk): number {
        if (left.distance !== right.distance) return left.distance - right.distance;
        if (left.loaded.chunk.x !== right.loaded.chunk.x) {
            return left.loaded.chunk.x - right.loaded.chunk.x;
        }
        return left.loaded.chunk.z - right.loaded.chunk.z;
    }

    private static distance(chunk: ChunkCoordinate, position: VoxelPosition): number {
        const deltaX = chunk.x * 16 + 8 - position.x;
        const deltaZ = chunk.z * 16 + 8 - position.z;
        return Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    }

    private static isPosition(position: VoxelPosition): boolean {
        return (
            Number.isInteger(position.x) &&
            Number.isInteger(position.y) &&
            Number.isInteger(position.z)
        );
    }
}

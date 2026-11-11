import type { ChunkCoordinate, PerceptionFailure, VoxelPosition } from './types.js';

export class PerceptionFailures {
    static invalidVersion(value: number): PerceptionFailure {
        return { type: 'INVALID_VERSION', value };
    }

    static invalidBlockPosition(position: VoxelPosition): PerceptionFailure {
        return { type: 'INVALID_BLOCK_POSITION', position };
    }

    static blockOutsideChunk(position: VoxelPosition, chunk: ChunkCoordinate): PerceptionFailure {
        return { type: 'BLOCK_OUTSIDE_CHUNK', position, chunk };
    }

    static invalidRateLimitOptions(tokensPerSecond: number, burst: number): PerceptionFailure {
        return { type: 'INVALID_RATE_LIMIT_OPTIONS', tokensPerSecond, burst };
    }

    static invalidRingRadius(value: number): PerceptionFailure {
        return { type: 'INVALID_RING_RADIUS', value };
    }

    static invalidTimestamp(value: string): PerceptionFailure {
        return { type: 'INVALID_TIMESTAMP', value };
    }

    static invalidBlockId(value: string): PerceptionFailure {
        return { type: 'INVALID_BLOCK_ID', value };
    }
}

import type { Result } from '@ticrafter/core';

import { PerceptionFailures } from './failures.js';
import type { ChunkSnapshot, ChunkSnapshotInput, PerceptionFailure, VoxelBlock } from './types.js';

const airBlockIds = new Set(['air', 'cave_air', 'void_air']);

export class ChunkSnapshotEncoder {
    encode(input: ChunkSnapshotInput): Result<ChunkSnapshot, PerceptionFailure> {
        if (!Number.isInteger(input.version) || input.version < 0) {
            return [null, PerceptionFailures.invalidVersion(input.version)];
        }
        const blocksByPosition = new Map<string, VoxelBlock>();
        for (const block of input.blocks) {
            const failure = ChunkSnapshotEncoder.validatePosition(block, input);
            if (failure) return [null, failure];
            if (airBlockIds.has(block.blockId)) continue;
            blocksByPosition.set(ChunkSnapshotEncoder.key(block), block);
        }
        return [
            {
                botId: input.botId,
                chunk: input.chunk,
                version: input.version,
                observedAt: input.observedAt,
                blocks: [...blocksByPosition.values()],
            },
            null,
        ];
    }

    private static validatePosition(
        block: VoxelBlock,
        input: ChunkSnapshotInput,
    ): PerceptionFailure | null {
        const { x, y, z } = block.position;
        if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
            return PerceptionFailures.invalidBlockPosition(block.position);
        }
        const minX = input.chunk.x * 16;
        const minZ = input.chunk.z * 16;
        const insideChunk = x >= minX && x < minX + 16 && z >= minZ && z < minZ + 16;
        if (!insideChunk) {
            return PerceptionFailures.blockOutsideChunk(block.position, input.chunk);
        }
        return null;
    }

    private static key(block: VoxelBlock): string {
        return `${block.position.x},${block.position.y},${block.position.z}`;
    }
}

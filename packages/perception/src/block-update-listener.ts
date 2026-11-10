import type { Result } from '@ticrafter/core';

import type { ChunkCoordinate, PerceptionFailure, VoxelBlock, VoxelPosition } from './types.js';

export interface BlockUpdate {
    position: VoxelPosition;
    blockId: string;
    solid: boolean;
    properties?: Readonly<Record<string, string>>;
}

export interface BlockUpdateObservation {
    type: 'block-update';
    botId: string;
    chunk: ChunkCoordinate;
    observedAt: string;
    block: VoxelBlock;
}

export class BlockUpdateListener {
    observe(
        botId: string,
        update: BlockUpdate,
        observedAt: string,
    ): Result<BlockUpdateObservation, PerceptionFailure> {
        if (!BlockUpdateListener.isPosition(update.position)) {
            return [null, { type: 'INVALID_BLOCK_POSITION', position: update.position }];
        }
        if (update.blockId.length === 0) {
            return [null, { type: 'INVALID_BLOCK_ID', value: update.blockId }];
        }
        if (Number.isNaN(Date.parse(observedAt))) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        return [
            {
                type: 'block-update',
                botId,
                chunk: {
                    x: Math.floor(update.position.x / 16),
                    z: Math.floor(update.position.z / 16),
                },
                observedAt,
                block: {
                    position: { ...update.position },
                    blockId: update.blockId,
                    solid: update.solid,
                    ...(update.properties === undefined ? {} : { properties: update.properties }),
                },
            },
            null,
        ];
    }

    private static isPosition(position: VoxelPosition): boolean {
        return (
            Number.isInteger(position.x) &&
            Number.isInteger(position.y) &&
            Number.isInteger(position.z)
        );
    }
}

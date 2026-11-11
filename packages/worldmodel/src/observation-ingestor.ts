import type { Result } from '@ticrafter/core';

import type { ChunkStorePort } from './chunk-version-store.js';
import { WorldFailures } from './failures.js';
import type {
    BlockUpdateObservation,
    ChunkBlockObservation,
    ChunkIngestResult,
    ChunkObservation,
    WorldFailure,
} from './types.js';

const airBlockIds = new Set(['air', 'cave_air', 'void_air']);

export class ObservationIngestor {
    constructor(private readonly chunks: ChunkStorePort) {}

    ingest(observation: ChunkObservation): Result<ChunkIngestResult, WorldFailure> {
        const [existing, readError] = this.chunks.get(observation.chunk);
        if (readError) {
            return [null, readError];
        }
        if (existing !== null && existing.version >= observation.version) {
            return [
                {
                    chunk: observation.chunk,
                    version: existing.version,
                    outcome: 'ignored',
                },
                null,
            ];
        }
        const [, writeError] = this.chunks.save({
            chunk: observation.chunk,
            version: observation.version,
            observedAt: observation.observedAt,
            blocks: observation.blocks,
        });
        if (writeError) {
            return [null, writeError];
        }
        return [
            {
                chunk: observation.chunk,
                version: observation.version,
                outcome: 'stored',
            },
            null,
        ];
    }

    applyBlockUpdate(update: BlockUpdateObservation): Result<ChunkIngestResult, WorldFailure> {
        const expectedChunk = {
            x: Math.floor(update.block.position.x / 16),
            z: Math.floor(update.block.position.z / 16),
        };
        if (
            expectedChunk.x !== update.chunk.x ||
            expectedChunk.z !== update.chunk.z ||
            !ObservationIngestor.isPosition(update.block.position)
        ) {
            return [null, WorldFailures.invalidBlockPosition(update.block.position)];
        }
        const [existing, readError] = this.chunks.get(update.chunk);
        if (readError) return [null, readError];
        const version = (existing?.version ?? 0) + 1;
        const blocks = ObservationIngestor.apply(existing?.blocks ?? [], update.block);
        const [, writeError] = this.chunks.save({
            chunk: update.chunk,
            version,
            observedAt: update.observedAt,
            blocks,
        });
        if (writeError) return [null, writeError];
        return [{ chunk: update.chunk, version, outcome: 'stored' }, null];
    }

    private static apply(
        blocks: readonly ChunkBlockObservation[],
        update: ChunkBlockObservation,
    ): readonly ChunkBlockObservation[] {
        const byPosition = new Map<string, ChunkBlockObservation>();
        blocks.forEach((block) => byPosition.set(ObservationIngestor.key(block.position), block));
        const key = ObservationIngestor.key(update.position);
        if (airBlockIds.has(update.blockId)) {
            byPosition.delete(key);
        } else {
            byPosition.set(key, update);
        }
        return [...byPosition.values()];
    }

    private static key(position: ChunkBlockObservation['position']): string {
        return `${position.x}:${position.y}:${position.z}`;
    }

    private static isPosition(position: ChunkBlockObservation['position']): boolean {
        return (
            Number.isInteger(position.x) &&
            Number.isInteger(position.y) &&
            Number.isInteger(position.z)
        );
    }
}

import { attempt, type Result } from '@ticrafter/core';
import { type ChunkRecord, WorldStore } from '@ticrafter/memory';

import type { ChunkStorePort } from './chunk-version-store.js';
import { WorldFailures } from './failures.js';
import type { ChunkBlockObservation, ChunkCoordinate, StoredChunk, WorldFailure } from './types.js';

interface ChunkPayload {
    observedAt: string;
    blocks: readonly ChunkBlockObservation[];
}

export class SqliteChunkStore implements ChunkStorePort {
    constructor(private readonly store: WorldStore) {}

    get(chunk: ChunkCoordinate): Result<StoredChunk | null, WorldFailure> {
        const [record, readError] = this.store.getChunk(chunk.x, chunk.z);
        if (readError) {
            return [null, WorldFailures.storageFailed(readError.message)];
        }
        if (record === null) {
            return [null, null];
        }
        return this.toChunk(record);
    }

    list(): Result<readonly StoredChunk[], WorldFailure> {
        const [records, readError] = this.store.listChunks();
        if (readError) {
            return [null, WorldFailures.storageFailed(readError.message)];
        }
        if (records === null) {
            return [null, WorldFailures.storageFailed('chunk list returned null')];
        }
        const chunks: StoredChunk[] = [];
        for (const record of records) {
            const [chunk, mappingError] = this.toChunk(record);
            if (mappingError) {
                return [null, mappingError];
            }
            if (chunk !== null) {
                chunks.push(chunk);
            }
        }
        return [chunks, null];
    }

    save(chunk: StoredChunk): Result<void, WorldFailure> {
        const [, writeError] = this.store.saveChunk(SqliteChunkStore.toRecord(chunk));
        if (writeError) {
            return [null, WorldFailures.storageFailed(writeError.message)];
        }
        return [undefined, null];
    }

    private toChunk(record: ChunkRecord): Result<StoredChunk, WorldFailure> {
        const [payload, parseError] = attempt(() => JSON.parse(record.payloadJson) as ChunkPayload);
        if (parseError) {
            return [null, WorldFailures.storageFailed('invalid stored chunk JSON')];
        }
        if (payload === null || !Array.isArray(payload.blocks)) {
            return [null, WorldFailures.storageFailed('chunk blocks must be an array')];
        }
        return [
            {
                chunk: { x: record.x, z: record.z },
                version: record.version,
                observedAt: payload.observedAt,
                blocks: payload.blocks,
            },
            null,
        ];
    }

    private static toRecord(chunk: StoredChunk): ChunkRecord {
        return {
            x: chunk.chunk.x,
            z: chunk.chunk.z,
            version: chunk.version,
            payloadJson: JSON.stringify({
                observedAt: chunk.observedAt,
                blocks: chunk.blocks,
            }),
            updatedAt: chunk.observedAt,
        };
    }
}

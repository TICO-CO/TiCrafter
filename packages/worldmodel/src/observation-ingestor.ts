import type { Result } from '@ticrafter/core';

import type { ChunkStorePort } from './chunk-version-store.js';
import type { ChunkIngestResult, ChunkObservation, WorldFailure } from './types.js';

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
}

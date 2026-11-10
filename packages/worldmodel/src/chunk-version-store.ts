import type { Result } from '@ticrafter/core';

import type { ChunkCoordinate, StoredChunk, WorldFailure } from './types.js';

export interface ChunkStorePort {
    get(chunk: ChunkCoordinate): Result<StoredChunk | null, WorldFailure>;
    list(): Result<readonly StoredChunk[], WorldFailure>;
    save(chunk: StoredChunk): Result<void, WorldFailure>;
}

export class InMemoryChunkStore implements ChunkStorePort {
    private readonly chunks = new Map<string, StoredChunk>();

    get(chunk: ChunkCoordinate): Result<StoredChunk | null, WorldFailure> {
        return [this.chunks.get(InMemoryChunkStore.key(chunk)) ?? null, null];
    }

    list(): Result<readonly StoredChunk[], WorldFailure> {
        return [[...this.chunks.values()], null];
    }

    save(chunk: StoredChunk): Result<void, WorldFailure> {
        this.chunks.set(InMemoryChunkStore.key(chunk.chunk), chunk);
        return [undefined, null];
    }

    private static key(chunk: ChunkCoordinate): string {
        return `${chunk.x}:${chunk.z}`;
    }
}

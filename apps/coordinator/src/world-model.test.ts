import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import type { ChunkSnapshotMessage, LandmarkCandidateMessage, LoggerPort } from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime, WorldStore } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from './core/index.js';
import { CoordinatorWorldModel } from './world-model.js';

const temporaryDirectories: string[] = [];
const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function openDatabase(): CoordinatorDatabase | null {
    const directory = fileSystem.mkdtempSync(
        path.join(operatingSystem.tmpdir(), 'ticrafter-world-model-'),
    );
    temporaryDirectories.push(directory);
    const [database, openError] = new SqliteRuntime({ dataDir: directory }).open();
    if (openError || database === null) return null;
    const [, migrationError] = new MigrationRunner(database).run();
    if (migrationError) return null;
    return database;
}

function chunkPayload(): ChunkSnapshotMessage {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        version: 1,
        observedAt: '2026-11-10T12:00:00.000Z',
        blocks: [
            {
                position: { x: 0, y: 64, z: 0 },
                blockId: 'stone',
                solid: true,
            },
        ],
    };
}

function landmarkPayload(observedAt: string, offset = 0): LandmarkCandidateMessage {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        observedAt,
        candidate: {
            detectorId: 'house',
            type: 'house',
            bbox: {
                min: { x: offset, y: 63, z: 0 },
                max: { x: 5 + offset, y: 68, z: 5 },
            },
            anchors: [{ name: 'center', position: { x: 2, y: 65, z: 2 } }],
            confidence: 0.8,
            evidence: 'enclosed house fixture',
        },
    };
}

afterEach(() => {
    temporaryDirectories
        .splice(0)
        .forEach((directory) => fileSystem.rmSync(directory, { recursive: true, force: true }));
});

describe('CoordinatorWorldModel', () => {
    it('persists chunk observations and merged landmarks', () => {
        const database = openDatabase();
        if (database === null) return;
        const model = new CoordinatorWorldModel(database, logger);

        const [, chunkError] = model.ingestChunk(chunkPayload());
        const [, firstLandmarkError] = model.ingestLandmark(
            landmarkPayload('2026-11-10T12:00:00.000Z'),
        );
        const [, secondLandmarkError] = model.ingestLandmark(
            landmarkPayload('2026-11-10T13:00:00.000Z', 1),
        );
        const store = new WorldStore(database);
        const [chunks, chunkListError] = store.listChunks();
        const [landmarks, landmarkListError] = store.listLandmarks();

        expect(chunkError).toBeNull();
        expect(firstLandmarkError).toBeNull();
        expect(secondLandmarkError).toBeNull();
        expect(chunkListError).toBeNull();
        expect(landmarkListError).toBeNull();
        expect(chunks).toHaveLength(1);
        expect(chunks?.[0]?.version).toBe(1);
        expect(landmarks).toHaveLength(1);
        expect(landmarks?.[0]?.type).toBe('house');
        expect(landmarks?.[0]?.lastSeen).toBe('2026-11-10T13:00:00.000Z');
        database.close();
    });
});

import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import type { ChunkSnapshotMessage, LandmarkCandidateMessage, LoggerPort } from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime, WorldStore } from '@ticrafter/memory';
import type { BlockUpdateObservation } from '@ticrafter/worldmodel';
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

function storagePayload(observedAt: string): LandmarkCandidateMessage {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        observedAt,
        candidate: {
            detectorId: 'storage-workstation',
            type: 'storage',
            bbox: {
                min: { x: 10, y: 63, z: 0 },
                max: { x: 10, y: 64, z: 0 },
            },
            anchors: [{ name: 'chest-0', position: { x: 10, y: 64, z: 0 } }],
            confidence: 0.9,
            evidence: 'chest fixture',
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

    it('merges observations from multiple bots', () => {
        const database = openDatabase();
        if (database === null) return;
        const model = new CoordinatorWorldModel(database, logger);

        model.ingestLandmark(landmarkPayload('2026-11-10T12:00:00.000Z'));
        model.ingestLandmark({
            ...landmarkPayload('2026-11-10T13:00:00.000Z'),
            botId: 'bot.tibot2',
        });

        const store = new WorldStore(database);
        const [landmarks] = store.listLandmarks();
        expect(landmarks).toHaveLength(1);
        expect(landmarks?.[0]?.evidenceJson.includes('bot.tibot2')).toBe(true);
        database.close();
    });

    it('applies plan tags and exposes spatial queries', () => {
        const database = openDatabase();
        if (database === null) return;
        const model = new CoordinatorWorldModel(database, logger);
        model.replacePlanTags(
            [
                {
                    planId: 'structure.house.1',
                    bbox: {
                        min: { x: 0, y: 63, z: 0 },
                        max: { x: 5, y: 68, z: 5 },
                    },
                    revision: 1,
                },
            ],
            1,
        );
        model.ingestLandmark(landmarkPayload('2026-11-10T12:00:00.000Z'));

        const [nearest] = model.nearest({ x: 0, y: 64, z: 0 }, 'house');
        const store = new WorldStore(database);
        const [landmarks] = store.listLandmarks();
        expect(nearest?.landmark.planId).toBe('structure.house.1');
        expect(landmarks?.[0]?.planId).toBe('structure.house.1');
        database.close();
    });

    it('records containers from storage candidates', () => {
        const database = openDatabase();
        if (database === null) return;
        const model = new CoordinatorWorldModel(database, logger);
        model.ingestLandmark(storagePayload('2026-11-10T12:00:00.000Z'));

        const [container, error] = model.containerAt({ x: 10, y: 64, z: 0 });

        expect(error).toBeNull();
        expect(container?.role).toBe('storage');
        database.close();
    });

    it('ingests block updates and refreshes occupancy', () => {
        const database = openDatabase();
        if (database === null) return;
        const model = new CoordinatorWorldModel(database, logger);
        model.ingestChunk(chunkPayload());
        const update: BlockUpdateObservation = {
            botId: 'bot.tibot1',
            chunk: { x: 0, z: 0 },
            observedAt: '2026-11-10T12:00:10.000Z',
            block: {
                position: { x: 1, y: 64, z: 1 },
                blockId: 'dirt',
                solid: true,
            },
        };

        const [, updateError] = model.ingestBlockUpdate(update);
        const [block, blockError] = model.blockAt({ x: 1, y: 64, z: 1 });

        expect(updateError).toBeNull();
        expect(blockError).toBeNull();
        expect(block?.blockId).toBe('dirt');
        database.close();
    });

    it('applies confidence decay', () => {
        const database = openDatabase();
        if (database === null) return;
        const model = new CoordinatorWorldModel(database, logger);
        model.ingestLandmark(landmarkPayload('2026-11-10T12:00:00.000Z'));

        const [decayed, decayError] = model.applyDecay('2026-11-11T12:00:00.000Z');
        const store = new WorldStore(database);
        const [landmarks] = store.listLandmarks();

        expect(decayError).toBeNull();
        expect((decayed?.[0]?.landmark.confidence ?? 1) < 0.8).toBe(true);
        expect((landmarks?.[0]?.confidence ?? 1) < 0.8).toBe(true);
        database.close();
    });
});

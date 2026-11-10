import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MigrationRunner, SqliteRuntime, WorldStore } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { SqliteLandmarkStore } from './sqlite-landmark-store.js';
import type { Landmark } from './types.js';

const landmark: Landmark = {
    id: 'landmark.bridge.1',
    type: 'bridge',
    bbox: {
        min: { x: 0, y: 64, z: 0 },
        max: { x: 12, y: 64, z: 3 },
    },
    anchors: [{ name: 'deck', position: { x: 0, y: 64, z: 0 } }],
    confidence: 0.7,
    lastSeen: '2026-11-10T12:00:00.000Z',
    evidence: [
        {
            sourceBotId: 'bot.tibot1',
            observedAt: '2026-11-10T12:00:00.000Z',
            confidence: 0.7,
            details: 'deck over air',
        },
    ],
    planId: 'plan.bridge.1',
};

describe('SqliteLandmarkStore', () => {
    it('round-trips a landmark through SQLite', () => {
        const directory = mkdtempSync(join(tmpdir(), 'ticrafter-worldmodel-'));
        const [database, openError] = new SqliteRuntime({ dataDir: directory }).open();
        expect(openError).toBeNull();
        if (database === null) return;
        const [, migrationError] = new MigrationRunner(database).run();
        expect(migrationError).toBeNull();

        const store = new SqliteLandmarkStore(new WorldStore(database));
        const [, saveError] = store.save(landmark);
        expect(saveError).toBeNull();

        const [stored, readError] = store.get(landmark.id);
        expect(readError).toBeNull();
        expect(stored).toEqual(landmark);

        const [landmarks, listError] = store.list();
        expect(listError).toBeNull();
        expect(landmarks).toHaveLength(1);

        database.close();
        rmSync(directory, { recursive: true, force: true });
    });
});

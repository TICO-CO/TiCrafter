import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MigrationRunner, SqliteRuntime, WorldStore } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { SqliteContainerObservationStore } from './sqlite-container-observation-store.js';
import type { ContainerObservation } from './types.js';

const observation: ContainerObservation = {
    id: 'container.chest.1',
    position: { x: 1, y: 64, z: 1 },
    role: 'tools',
    contents: [{ itemId: 'minecraft:iron_pickaxe', count: 1 }],
    observedAt: '2026-11-10T12:00:00.000Z',
    confidence: 0.8,
};

describe('SqliteContainerObservationStore', () => {
    it('round-trips container observations through SQLite', () => {
        const directory = mkdtempSync(join(tmpdir(), 'ticrafter-worldmodel-'));
        const [database, openError] = new SqliteRuntime({ dataDir: directory }).open();
        expect(openError).toBeNull();
        if (database === null) return;
        const [, migrationError] = new MigrationRunner(database).run();
        expect(migrationError).toBeNull();

        const store = new SqliteContainerObservationStore(new WorldStore(database));
        const [, saveError] = store.save(observation);
        expect(saveError).toBeNull();

        const [stored, readError] = store.get(observation.id);
        expect(readError).toBeNull();
        expect(stored).toEqual(observation);

        const [observations, listError] = store.list();
        expect(listError).toBeNull();
        expect(observations).toHaveLength(1);

        database.close();
        rmSync(directory, { recursive: true, force: true });
    });
});

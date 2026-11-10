import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MigrationRunner, SqliteRuntime, WorldStore } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { SqliteChunkStore } from './sqlite-chunk-store.js';
import type { StoredChunk } from './types.js';

const chunk: StoredChunk = {
    chunk: { x: 0, z: 0 },
    version: 3,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: [
        {
            position: { x: 1, y: 64, z: 1 },
            blockId: 'stone',
            solid: true,
        },
    ],
};

describe('SqliteChunkStore', () => {
    it('round-trips a chunk through SQLite', () => {
        const directory = mkdtempSync(join(tmpdir(), 'ticrafter-chunks-'));
        const [database, openError] = new SqliteRuntime({ dataDir: directory }).open();
        expect(openError).toBeNull();
        if (database === null) return;
        const [, migrationError] = new MigrationRunner(database).run();
        expect(migrationError).toBeNull();

        const store = new SqliteChunkStore(new WorldStore(database));
        const [, saveError] = store.save(chunk);
        expect(saveError).toBeNull();

        const [stored, readError] = store.get(chunk.chunk);
        expect(readError).toBeNull();
        expect(stored).toEqual(chunk);

        const [chunks, listError] = store.list();
        expect(listError).toBeNull();
        expect(chunks).toHaveLength(1);

        database.close();
        rmSync(directory, { recursive: true, force: true });
    });
});

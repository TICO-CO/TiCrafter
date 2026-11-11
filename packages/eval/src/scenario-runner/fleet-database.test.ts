import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteRuntime } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import { FleetDatabase } from './fleet-database.js';
import type { ScenarioDefinition } from './index.js';

const directories: string[] = [];

const definition: ScenarioDefinition = {
    id: 'house-build',
    title: 'Test',
    bots: [{ name: 'TiBot1', role: 'builder' }],
    timeoutMilliseconds: 1000,
    tasks: [
        {
            id: 'task-1',
            title: 'Navigate',
            skillId: 'navigate',
            payload: { target: { x: 0, y: 64, z: 1 } },
        },
    ],
};

describe('FleetDatabase', () => {
    afterEach(() => {
        directories
            .splice(0)
            .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
    });

    it('seeds tasks and observes completion plus sessions', () => {
        const directory = mkdtempSync(join(tmpdir(), 'ticrafter-eval-'));
        directories.push(directory);

        const [, prepareError] = FleetDatabase.prepare(directory, definition);
        expect(prepareError).toBeNull();
        const [before] = FleetDatabase.observe(directory, definition);
        expect(before?.passed).toBe(false);

        const [database, databaseError] = new SqliteRuntime({ dataDir: directory }).open();
        expect(databaseError).toBeNull();
        if (database === null) return;
        database.prepare("UPDATE tasks SET status = 'completed' WHERE id = 'task-1'").run();
        database
            .prepare(
                "INSERT INTO bot_events (bot_id, type, payload_json, created_at) VALUES ('bot.tibot1', 'session.joined', '{}', '2026-11-11T10:00:00.000Z')",
            )
            .run();
        database.close();

        const [after, observeError] = FleetDatabase.observe(directory, definition);
        expect(observeError).toBeNull();
        expect(after?.passed).toBe(true);
        expect(after?.events).toBe(1);
    });
});

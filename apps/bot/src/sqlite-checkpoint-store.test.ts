import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MigrationRunner, SqliteRuntime, SqliteSkillCheckpointStore } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import { SqliteCheckpointStore } from './sqlite-checkpoint-store.js';

type CheckpointDatabase = NonNullable<ReturnType<SqliteRuntime['open']>[0]>;

interface TemporaryStore {
    store: SqliteCheckpointStore;
    database: CheckpointDatabase;
}

const temporaryDirectories: string[] = [];

function openStore(): TemporaryStore | null {
    const directory = mkdtempSync(join(tmpdir(), 'ticrafter-bot-checkpoints-'));
    temporaryDirectories.push(directory);
    const [database, openError] = new SqliteRuntime({ dataDir: directory }).open();
    if (openError || database === null) return null;
    const [, migrationError] = new MigrationRunner(database).run();
    if (migrationError) return null;
    return {
        store: new SqliteCheckpointStore(new SqliteSkillCheckpointStore(database)),
        database,
    };
}

afterEach(() => {
    temporaryDirectories
        .splice(0)
        .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('SqliteCheckpointStore', () => {
    it('round-trips checkpoints per task', () => {
        const opened = openStore();
        expect(opened).not.toBeNull();
        if (opened === null) return;
        const { store, database } = opened;

        const [, firstSaveError] = store.save({
            id: 'bot.tibot1:task-mining:navigate',
            botId: 'bot.tibot1',
            taskId: 'task-mining',
            skillId: 'navigate',
            stateJson: '{"target":{"x":1,"y":64,"z":0}}',
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(firstSaveError).toBeNull();
        const [, secondSaveError] = store.save({
            id: 'bot.tibot1:task-building:navigate',
            botId: 'bot.tibot1',
            taskId: 'task-building',
            skillId: 'navigate',
            stateJson: '{"target":{"x":8,"y":64,"z":0}}',
            updatedAt: '2026-11-10T12:01:00.000Z',
        });
        expect(secondSaveError).toBeNull();

        const [mining, miningError] = store.load('bot.tibot1', 'task-mining', 'navigate');
        expect(miningError).toBeNull();
        expect(mining?.taskId).toBe('task-mining');
        expect(mining?.stateJson).toBe('{"target":{"x":1,"y":64,"z":0}}');

        const [building, buildingError] = store.load('bot.tibot1', 'task-building', 'navigate');
        expect(buildingError).toBeNull();
        expect(building?.stateJson).toBe('{"target":{"x":8,"y":64,"z":0}}');

        const [missing, missingError] = store.load('bot.tibot1', 'task-missing', 'navigate');
        expect(missingError).toBeNull();
        expect(missing).toBeNull();

        const [, deleteError] = store.delete('bot.tibot1', 'task-mining', 'navigate');
        expect(deleteError).toBeNull();
        const [deleted, deletedError] = store.load('bot.tibot1', 'task-mining', 'navigate');
        expect(deletedError).toBeNull();
        expect(deleted).toBeNull();

        const [survivor, survivorError] = store.load('bot.tibot1', 'task-building', 'navigate');
        expect(survivorError).toBeNull();
        expect(survivor?.stateJson).toBe('{"target":{"x":8,"y":64,"z":0}}');
        database.close();
    });

    it('maps storage failures to strings', () => {
        const opened = openStore();
        expect(opened).not.toBeNull();
        if (opened === null) return;
        const { store, database } = opened;
        database.close();

        const [saved, saveError] = store.save({
            id: 'bot.tibot1:task-mining:navigate',
            botId: 'bot.tibot1',
            taskId: 'task-mining',
            skillId: 'navigate',
            stateJson: '{}',
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(saved).toBeNull();
        expect(saveError).not.toBeNull();
        if (saveError === null) return;
        expect(saveError.length === 0).toBe(false);
    });
});

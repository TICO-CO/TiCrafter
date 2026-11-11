import { afterEach, describe, expect, it } from 'bun:test';

import { SqliteSkillCheckpointStore } from './skill-checkpoint-store.js';
import { TestDatabase } from './test-database.js';

afterEach(() => {
    TestDatabase.cleanup();
});

describe('SqliteSkillCheckpointStore', () => {
    it('round-trips skill checkpoints with task ids', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new SqliteSkillCheckpointStore(database);

        const [, saveError] = store.save({
            id: 'bot.tibot1:task-1:navigate',
            botId: 'bot.tibot1',
            taskId: 'task-1',
            skillId: 'navigate',
            stateJson: '{"target":{"x":1,"y":64,"z":0}}',
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(saveError).toBeNull();

        const [record, readError] = store.load('bot.tibot1', 'task-1', 'navigate');
        expect(readError).toBeNull();
        expect(record?.taskId).toBe('task-1');
        expect(record?.stateJson).toBe('{"target":{"x":1,"y":64,"z":0}}');

        const [, deleteError] = store.delete('bot.tibot1', 'task-1', 'navigate');
        expect(deleteError).toBeNull();
        const [deleted, deletedError] = store.load('bot.tibot1', 'task-1', 'navigate');
        expect(deletedError).toBeNull();
        expect(deleted).toBeNull();
        database.close();
    });

    it('keeps checkpoints for different tasks separate', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new SqliteSkillCheckpointStore(database);

        const [, firstSaveError] = store.save({
            id: 'bot.tibot1:task-1:navigate',
            botId: 'bot.tibot1',
            taskId: 'task-1',
            skillId: 'navigate',
            stateJson: '{"target":{"x":1,"y":64,"z":0}}',
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(firstSaveError).toBeNull();
        const [, secondSaveError] = store.save({
            id: 'bot.tibot1:task-2:navigate',
            botId: 'bot.tibot1',
            taskId: 'task-2',
            skillId: 'navigate',
            stateJson: '{"target":{"x":8,"y":64,"z":0}}',
            updatedAt: '2026-11-10T12:01:00.000Z',
        });
        expect(secondSaveError).toBeNull();

        const [first, firstError] = store.load('bot.tibot1', 'task-1', 'navigate');
        expect(firstError).toBeNull();
        expect(first?.stateJson).toBe('{"target":{"x":1,"y":64,"z":0}}');

        const [second, secondError] = store.load('bot.tibot1', 'task-2', 'navigate');
        expect(secondError).toBeNull();
        expect(second?.stateJson).toBe('{"target":{"x":8,"y":64,"z":0}}');

        const [, deleteError] = store.delete('bot.tibot1', 'task-1', 'navigate');
        expect(deleteError).toBeNull();
        const [deleted, deletedError] = store.load('bot.tibot1', 'task-1', 'navigate');
        expect(deletedError).toBeNull();
        expect(deleted).toBeNull();

        const [survivor, survivorError] = store.load('bot.tibot1', 'task-2', 'navigate');
        expect(survivorError).toBeNull();
        expect(survivor?.stateJson).toBe('{"target":{"x":8,"y":64,"z":0}}');
        database.close();
    });
});

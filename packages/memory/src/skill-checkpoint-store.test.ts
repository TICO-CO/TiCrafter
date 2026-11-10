import { afterEach, describe, expect, it } from 'bun:test';

import { SqliteSkillCheckpointStore } from './skill-checkpoint-store.js';
import { TestDatabase } from './test-database.js';

afterEach(() => {
    TestDatabase.cleanup();
});

describe('SqliteSkillCheckpointStore', () => {
    it('round-trips skill checkpoints', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new SqliteSkillCheckpointStore(database);

        const [, saveError] = store.save({
            id: 'bot.tibot1:navigate',
            botId: 'bot.tibot1',
            skillId: 'navigate',
            stateJson: '{"target":{"x":1,"y":64,"z":0}}',
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(saveError).toBeNull();

        const [record, readError] = store.load('bot.tibot1', 'navigate');
        expect(readError).toBeNull();
        expect(record?.stateJson).toBe('{"target":{"x":1,"y":64,"z":0}}');

        const [, deleteError] = store.delete('bot.tibot1', 'navigate');
        expect(deleteError).toBeNull();
        const [deleted, deletedError] = store.load('bot.tibot1', 'navigate');
        expect(deletedError).toBeNull();
        expect(deleted).toBeNull();
        database.close();
    });
});

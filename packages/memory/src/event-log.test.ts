import { afterEach, describe, expect, it } from 'bun:test';

import { type DomainEvent, EventLogWriter, RetentionPruner } from './index.js';
import { TestDatabase } from './test-database.js';

afterEach(() => {
    TestDatabase.cleanup();
});

describe('event log', () => {
    it('appends and lists events', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;

        const writer = new EventLogWriter(database);
        const [id, appendError] = writer.append({
            botId: 'bot.alpha',
            type: 'joined',
            payload: { amount: 1 },
        });
        expect(appendError).toBeNull();
        expect(id).not.toBeNull();

        const [events, listError] = writer.list();
        expect(listError).toBeNull();
        if (events === null) return;
        expect(events[0]).toMatchObject({
            botId: 'bot.alpha',
            type: 'joined',
            payload: { amount: 1 },
        });
        database.close();
    });

    it('prunes old events and block changes', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;

        const writer = new EventLogWriter(database);
        const oldTimestamp = new Date('2025-01-01T00:00:00.000Z').toISOString();
        const [, oldError] = writer.append({ type: 'old', createdAt: oldTimestamp });
        expect(oldError).toBeNull();
        const [, newError] = writer.append({ type: 'new' });
        expect(newError).toBeNull();

        const [pruned, pruneError] = new RetentionPruner(database).prune(
            30,
            new Date('2025-03-01T00:00:00.000Z'),
        );
        expect(pruneError).toBeNull();
        expect(pruned).toEqual({ events: 1, blockChanges: 0 });

        const [events, listError] = writer.list();
        expect(listError).toBeNull();
        if (events === null) return;
        expect(events.map((event: DomainEvent) => event.type)).toEqual(['new']);
        database.close();
    });
});

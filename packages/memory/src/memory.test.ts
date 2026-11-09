import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'bun:test';
import type { Result } from '@ticrafter/core';
import {
    EventLogWriter,
    MigrationRunner,
    RetentionPruner,
    SchemaVersionRegistry,
    SqliteRuntime,
    TransactionManager,
    type DomainEvent,
    type StorageFailure,
} from './index.js';

const tempDirs: string[] = [];

class TempDatabase {
    static directory(): string {
        const dir = mkdtempSync(join(tmpdir(), 'ticrafter-memory-'));
        tempDirs.push(dir);
        return dir;
    }

    static open(dataDir: string): Result<Database, StorageFailure> {
        const [database, openError] = new SqliteRuntime({ dataDir }).open();
        if (openError) {
            return [null, openError];
        }
        if (database === null) {
            return [null, { type: 'DATABASE_OPEN_FAILED', message: 'Database missing' }];
        }
        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) {
            return [null, migrationError];
        }

        return [database, null];
    }
}

afterEach(() => {
    tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('memory', () => {
    it('migrates idempotently', () => {
        const [database, openError] = new SqliteRuntime({
            dataDir: TempDatabase.directory(),
        }).open();
        expect(openError).toBeNull();
        if (database === null) {
            return;
        }
        const runner = new MigrationRunner(database);
        const [firstVersion, firstError] = runner.run();
        expect(firstError).toBeNull();
        expect(firstVersion).toBe(1);
        const [secondVersion, secondError] = runner.run();
        expect(secondError).toBeNull();
        expect(secondVersion).toBe(1);
        const [currentVersion, currentError] = new SchemaVersionRegistry(database).current();
        expect(currentError).toBeNull();
        expect(currentVersion).toBe(1);
        const tables = (
            database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
                name: string;
            }>
        ).map((row) => row.name);
        expect(tables).toEqual(
            expect.arrayContaining([
                'bots',
                'tasks',
                'claims',
                'sip',
                'coordinator_state',
                'block_changelog',
            ]),
        );
        database.close();
    });

    it('appends and lists events', () => {
        const [database, openError] = TempDatabase.open(TempDatabase.directory());
        expect(openError).toBeNull();
        if (database === null) {
            return;
        }
        const writer = new EventLogWriter(database);
        const [id, appendError] = writer.append({
            botId: 'bot.a',
            type: 'joined',
            payload: { x: 1 },
        });
        expect(appendError).toBeNull();
        expect(id).not.toBeNull();
        const [events, listError] = writer.list();
        expect(listError).toBeNull();
        if (events === null) {
            return;
        }
        expect(events[0]).toMatchObject({ botId: 'bot.a', type: 'joined', payload: { x: 1 } });
        database.close();
    });

    it('rolls back failed transactions', () => {
        const [database, openError] = TempDatabase.open(TempDatabase.directory());
        expect(openError).toBeNull();
        if (database === null) {
            return;
        }
        const writer = new EventLogWriter(database);
        const [value, transactionError] = new TransactionManager(database).run(() => {
            const [, appendError] = writer.append({ type: 'before-failure' });
            expect(appendError).toBeNull();
            database.exec('INSERT INTO bot_events (type) VALUES (NULL)');
            return true;
        });
        expect(transactionError).not.toBeNull();
        expect(value).toBeNull();
        const [events, listError] = writer.list();
        expect(listError).toBeNull();
        if (events === null) {
            return;
        }
        expect(events).toHaveLength(0);
        database.close();
    });

    it('prunes old events and block changes', () => {
        const [database, openError] = TempDatabase.open(TempDatabase.directory());
        expect(openError).toBeNull();
        if (database === null) {
            return;
        }
        const writer = new EventLogWriter(database);
        const old = new Date('2025-01-01T00:00:00.000Z').toISOString();
        const [, oldError] = writer.append({ type: 'old', createdAt: old });
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
        if (events === null) {
            return;
        }
        expect(events.map((event: DomainEvent) => event.type)).toEqual(['new']);
        database.close();
    });

    it('enforces WAL journal mode', () => {
        const [database, openError] = TempDatabase.open(TempDatabase.directory());
        expect(openError).toBeNull();
        if (database === null) {
            return;
        }
        const mode = database.query('PRAGMA journal_mode').get() as { journal_mode: string };
        expect(mode.journal_mode).toBe('wal');
        database.close();
    });
});

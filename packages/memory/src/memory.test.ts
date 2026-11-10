import { afterEach, describe, expect, it } from 'bun:test';

import {
    EventLogWriter,
    MigrationRunner,
    SchemaVersionRegistry,
    SqliteRuntime,
    TransactionManager,
} from './index.js';
import { TestDatabase } from './test-database.js';

afterEach(() => {
    TestDatabase.cleanup();
});

describe('memory', () => {
    it('migrates idempotently', () => {
        const [database, openError] = new SqliteRuntime({
            dataDir: TestDatabase.directory(),
        }).open();
        expect(openError).toBeNull();
        if (database === null) return;

        const migrationRunner = new MigrationRunner(database);
        const [firstVersion, firstError] = migrationRunner.run();
        expect(firstError).toBeNull();
        expect(firstVersion).toBe(4);

        const [secondVersion, secondError] = migrationRunner.run();
        expect(secondError).toBeNull();
        expect(secondVersion).toBe(4);

        const [currentVersion, currentError] = new SchemaVersionRegistry(database).current();
        expect(currentError).toBeNull();
        expect(currentVersion).toBe(4);

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
                'world_container_observations',
            ]),
        );
        database.close();
    });

    it('rolls back failed transactions', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;

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
        if (events === null) return;
        expect(events).toHaveLength(0);
        database.close();
    });

    it('enforces WAL journal mode', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;

        const mode = database.query('PRAGMA journal_mode').get() as { journal_mode: string };
        expect(mode.journal_mode).toBe('wal');
        database.close();
    });
});

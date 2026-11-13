import { afterEach, describe, expect, it } from 'bun:test';

import {
    BlockChangelogReader,
    BlockChangelogWriter,
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
        expect(firstVersion).toBe(14);

        const [secondVersion, secondError] = migrationRunner.run();
        expect(secondError).toBeNull();
        expect(secondVersion).toBe(14);

        const [currentVersion, currentError] = new SchemaVersionRegistry(database).current();
        expect(currentError).toBeNull();
        expect(currentVersion).toBe(14);

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
                'planner_plans',
                'planner_responses',
                'agent_state',
                'agent_episodes',
                'personal_projects',
                'blueprint_documents',
                'construction_plans',
            ]),
        );
        database.close();
    });

    it('round-trips block changelog attribution', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;

        const [, migrationError] = new MigrationRunner(database).run();
        expect(migrationError).toBeNull();

        const writer = new BlockChangelogWriter(database);
        const [id, writeError] = writer.append({
            botId: 'bot.one',
            position: { x: 1, y: 64, z: 2 },
            before: { name: 'stone' },
            after: { name: 'oak_planks' },
            grantId: 'grant.one',
            claimId: 'claim.one',
            structureId: 'structure.home',
            blueprintId: 'blueprint.home',
            blueprintRevision: 4,
            workPackageId: 'package.walls',
            planId: 'plan.home',
            fencingToken: 9,
            phase: 'walls',
            createdAt: '2026-11-12T12:00:00.000Z',
        });
        expect(writeError).toBeNull();
        expect(id).toBe(1);

        const [changes, readError] = new BlockChangelogReader(database).listAfter(0);
        expect(readError).toBeNull();
        expect(changes).toEqual([
            {
                id: 1,
                botId: 'bot.one',
                position: { x: 1, y: 64, z: 2 },
                before: { name: 'stone' },
                after: { name: 'oak_planks' },
                grantId: 'grant.one',
                claimId: 'claim.one',
                structureId: 'structure.home',
                blueprintId: 'blueprint.home',
                blueprintRevision: 4,
                workPackageId: 'package.walls',
                planId: 'plan.home',
                fencingToken: 9,
                phase: 'walls',
                createdAt: '2026-11-12T12:00:00.000Z',
            },
        ]);
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

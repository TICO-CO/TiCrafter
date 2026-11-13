import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import type { Result } from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime, type StorageFailure } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import { type CoordinatorDatabase, EpochStore } from './epoch.js';
import { RestartRecovery } from './recovery.js';
import { SessionManager } from './session-manager.js';

const temporaryDirectories: string[] = [];

class TempDatabase {
    static directory(): string {
        const directory = fileSystem.mkdtempSync(
            path.join(operatingSystem.tmpdir(), 'ticrafter-coordinator-'),
        );
        temporaryDirectories.push(directory);
        return directory;
    }

    static open(): Result<CoordinatorDatabase, StorageFailure> {
        const [database, databaseError] = new SqliteRuntime({
            dataDir: TempDatabase.directory(),
        }).open();
        if (databaseError) return [null, databaseError];
        if (database === null) {
            return [null, { type: 'DATABASE_OPEN_FAILED', message: 'database missing' }];
        }

        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) return [null, migrationError];

        return [database, null];
    }
}

afterEach(() => {
    temporaryDirectories
        .splice(0)
        .forEach((directory) => fileSystem.rmSync(directory, { recursive: true, force: true }));
});

describe('coordinator core', () => {
    it('increments the coordinator epoch across restarts', () => {
        const [database, openError] = TempDatabase.open();
        expect(openError).toBeNull();
        if (database === null) return;

        const epochStore = new EpochStore(database);
        const [initialEpoch, initialError] = epochStore.current();
        expect(initialError).toBeNull();
        expect(initialEpoch).toBe(0);

        const [firstEpoch, firstError] = epochStore.bump();
        expect(firstError).toBeNull();
        expect(firstEpoch).toBe(1);

        const [secondEpoch, secondError] = epochStore.bump();
        expect(secondError).toBeNull();
        expect(secondEpoch).toBe(2);

        const [currentEpoch, currentError] = epochStore.current();
        expect(currentError).toBeNull();
        expect(currentEpoch).toBe(2);
        database.close();
    });

    it('revalidates leases, grants, tasks, and bots on restart', () => {
        const [database, openError] = TempDatabase.open();
        expect(openError).toBeNull();
        if (database === null) return;

        const now = new Date().toISOString();
        const later = new Date(Date.now() + 3_600_000).toISOString();
        const earlier = new Date(Date.now() - 3_600_000).toISOString();
        database
            .prepare(
                `INSERT INTO claims (
                    id, resource, owner_bot_id, lease_expires_at, fencing_token, created_at,
                    resource_type, status, task_id, epoch, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                'claim-live',
                'wp.live',
                'bot.one',
                later,
                1,
                now,
                'work_package',
                'active',
                null,
                3,
                now,
            );
        database
            .prepare(
                `INSERT INTO claims (
                    id, resource, owner_bot_id, lease_expires_at, fencing_token, created_at,
                    resource_type, status, task_id, epoch, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                'claim-stale',
                'wp.stale',
                'bot.one',
                earlier,
                2,
                now,
                'work_package',
                'active',
                'task-claim',
                3,
                now,
            );
        for (const [id, epoch, expiresAt] of [
            ['grant-current', 5, later],
            ['grant-stale', 4, later],
            ['grant-expired', 5, earlier],
        ] as const) {
            database
                .prepare(
                    `INSERT INTO edit_grants (
                        id, structure_id, owner_bot_id, grantee_bot_id, revision, status,
                        expires_at, created_at, epoch, fencing_token, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    id,
                    'structure.house',
                    'bot.one',
                    'bot.two',
                    1,
                    'active',
                    expiresAt,
                    now,
                    epoch,
                    1,
                    now,
                );
        }
        for (const [id, taskId, leaseUntil] of [
            ['task-live', null, later],
            ['task-expired-lease', null, earlier],
            ['task-claim', 'claim-stale', later],
        ] as const) {
            database
                .prepare(
                    `INSERT INTO tasks (
                        id, title, status, priority, retry_count, payload_json, created_at,
                        updated_at, claimed_by, lease_until, lease_token, available_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    id,
                    id,
                    'claimed',
                    0,
                    0,
                    '{}',
                    now,
                    now,
                    'bot.one',
                    leaseUntil,
                    taskId === null ? 1 : 2,
                    now,
                );
        }
        database
            .prepare(
                `INSERT INTO bots (id, name, created_at, updated_at, status)
                 VALUES (?, ?, ?, ?, ?)`,
            )
            .run('bot.one', 'TiBot1', now, now, 'online');

        const recovery = new RestartRecovery(database, 5);
        const [report, recoveryError] = recovery.run();
        expect(recoveryError).toBeNull();
        expect(report).toEqual({ claims: 1, grants: 2, tasks: 2, bots: 1 });

        const claimStatuses = database
            .prepare('SELECT id, status FROM claims ORDER BY id')
            .all() as { id: string; status: string }[];
        expect(claimStatuses).toEqual([
            { id: 'claim-live', status: 'active' },
            { id: 'claim-stale', status: 'expired' },
        ]);
        const grantStatuses = database
            .prepare('SELECT id, status FROM edit_grants ORDER BY id')
            .all() as { id: string; status: string }[];
        expect(grantStatuses).toEqual([
            { id: 'grant-current', status: 'active' },
            { id: 'grant-expired', status: 'expired' },
            { id: 'grant-stale', status: 'revoked' },
        ]);
        const taskStatuses = database
            .prepare('SELECT id, status, claimed_by FROM tasks ORDER BY id')
            .all() as { id: string; status: string; claimed_by: string | null }[];
        expect(taskStatuses).toEqual([
            { id: 'task-claim', status: 'ready', claimed_by: null },
            { id: 'task-expired-lease', status: 'ready', claimed_by: null },
            { id: 'task-live', status: 'claimed', claimed_by: 'bot.one' },
        ]);
        expect(
            (
                database.prepare("SELECT status FROM bots WHERE id = 'bot.one'").get() as {
                    status: string;
                }
            ).status,
        ).toBe('offline');

        const [second, secondError] = recovery.run();
        expect(secondError).toBeNull();
        expect(second).toEqual({ claims: 0, grants: 0, tasks: 0, bots: 0 });
        database.close();
    });

    it('tracks and prunes sessions', () => {
        const sessions = new SessionManager();
        sessions.add({
            botId: 'bot.alpha',
            name: 'Alpha',
            connectionId: 'connection-1',
            connectedAt: '2026-01-01T00:00:00.000Z',
            lastSeen: '2026-01-01T00:00:00.000Z',
            position: null,
        });
        expect(sessions.count()).toBe(1);
        sessions.touch('bot.alpha', '2026-01-01T00:00:10.000Z', { x: 1, y: 2, z: 3 });
        expect(sessions.get('bot.alpha')?.lastSeen).toBe('2026-01-01T00:00:10.000Z');
        expect(sessions.get('bot.alpha')?.position).toEqual({ x: 1, y: 2, z: 3 });
        expect(
            sessions.pruneStale(
                5000,
                Date.parse('2026-01-01T00:00:20.000Z'),
                (botId) => botId === 'bot.alpha',
            ),
        ).toEqual([]);
        expect(sessions.count()).toBe(1);
        expect(sessions.pruneStale(5000, Date.parse('2026-01-01T00:00:20.000Z'))).toEqual([
            'bot.alpha',
        ]);
        expect(sessions.count()).toBe(0);
    });
});

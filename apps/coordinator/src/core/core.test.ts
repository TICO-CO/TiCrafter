import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import type { Result } from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime, type StorageFailure } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import { type CoordinatorDatabase, EpochStore } from './epoch.js';
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

    it('tracks and prunes sessions', () => {
        const sessions = new SessionManager();
        sessions.add({
            botId: 'bot.alpha',
            name: 'Alpha',
            connectionId: 'connection-1',
            connectedAt: '2026-01-01T00:00:00.000Z',
            lastSeen: '2026-01-01T00:00:00.000Z',
        });
        expect(sessions.count()).toBe(1);
        sessions.touch('bot.alpha', '2026-01-01T00:00:10.000Z');
        expect(sessions.get('bot.alpha')?.lastSeen).toBe('2026-01-01T00:00:10.000Z');
        expect(sessions.pruneStale(5000, Date.parse('2026-01-01T00:00:20.000Z'))).toEqual([
            'bot.alpha',
        ]);
        expect(sessions.count()).toBe(0);
    });
});

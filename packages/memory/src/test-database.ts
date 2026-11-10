import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { MigrationRunner, SqliteRuntime, type StorageFailure } from './index.js';

const temporaryDirectories: string[] = [];

export class TestDatabase {
    static directory(): string {
        const directory = mkdtempSync(join(tmpdir(), 'ticrafter-memory-'));
        temporaryDirectories.push(directory);
        return directory;
    }

    static open(dataDirectory: string): Result<Database, StorageFailure> {
        const [database, openError] = new SqliteRuntime({ dataDir: dataDirectory }).open();
        if (openError) return [null, openError];
        if (database === null) {
            return [null, { type: 'DATABASE_OPEN_FAILED', message: 'database missing' }];
        }

        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) return [null, migrationError];

        return [database, null];
    }

    static openTemporary(): Result<Database, StorageFailure> {
        return TestDatabase.open(TestDatabase.directory());
    }

    static cleanup(): void {
        temporaryDirectories
            .splice(0)
            .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
    }
}

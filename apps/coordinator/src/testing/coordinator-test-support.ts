import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import type { Result } from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime, type StorageFailure } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';

const temporaryDirectories: string[] = [];

export class CoordinatorTestSupport {
    static openDatabase(): Result<CoordinatorDatabase, StorageFailure> {
        const directory = fileSystem.mkdtempSync(
            path.join(operatingSystem.tmpdir(), 'ticrafter-coordinator-'),
        );
        temporaryDirectories.push(directory);
        const [database, databaseError] = new SqliteRuntime({ dataDir: directory }).open();
        if (databaseError) return [null, databaseError];
        if (database === null) {
            return [null, { type: 'DATABASE_OPEN_FAILED', message: 'database missing' }];
        }
        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) return [null, migrationError];
        return [database, null];
    }

    static cleanup(): void {
        temporaryDirectories
            .splice(0)
            .forEach((directory) => fileSystem.rmSync(directory, { recursive: true, force: true }));
    }
}

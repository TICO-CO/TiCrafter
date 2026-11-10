import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { attempt, type Result } from '@ticrafter/core';
import { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export interface SqliteRuntimeOptions {
    dataDir: string;
    filename?: string;
    busyTimeoutMs?: number;
}

export class SqliteRuntime {
    constructor(private readonly options: SqliteRuntimeOptions) {}

    open(): Result<Database, StorageFailure> {
        const [database, error] = attempt(() => {
            mkdirSync(this.options.dataDir, { recursive: true });
            const filename = join(
                this.options.dataDir,
                this.options.filename ?? 'ticrafter.sqlite',
            );
            const database = new Database(filename);
            database.exec('PRAGMA journal_mode = WAL');
            database.exec(`PRAGMA busy_timeout = ${this.options.busyTimeoutMs ?? 5000}`);
            database.exec('PRAGMA foreign_keys = ON');
            return database;
        });
        if (error) {
            return [null, StorageFailures.from('DATABASE_OPEN_FAILED', error)];
        }

        return [database, null];
    }
}

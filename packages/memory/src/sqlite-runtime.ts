import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { attempt, type Result } from '@ticrafter/core';
import { StorageFailures, type StorageFailure } from './failures.js';

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
            const db = new Database(filename);
            db.exec('PRAGMA journal_mode = WAL');
            db.exec(`PRAGMA busy_timeout = ${this.options.busyTimeoutMs ?? 5000}`);
            db.exec('PRAGMA foreign_keys = ON');
            return db;
        });
        if (error) {
            return [null, StorageFailures.from('DATABASE_OPEN_FAILED', error)];
        }

        return [database, null];
    }
}

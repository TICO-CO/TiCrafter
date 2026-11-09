import type { Database } from 'bun:sqlite';
import { attempt, type Result } from '@ticrafter/core';
import { StorageFailures, type StorageFailure } from './failures.js';

interface VersionRow {
    version: number | null;
}

export class SchemaVersionRegistry {
    constructor(private readonly db: Database) {}

    current(): Result<number, StorageFailure> {
        const [version, error] = attempt(() => {
            const row = this.db
                .prepare('SELECT MAX(version) AS version FROM schema_version')
                .get() as VersionRow | null;
            return row?.version ?? 0;
        });
        if (error) {
            return [null, StorageFailures.from('SCHEMA_READ_FAILED', error)];
        }
        if (version === null) {
            return [null, StorageFailures.from('SCHEMA_READ_FAILED', 'Schema version missing')];
        }

        return [version, null];
    }
}

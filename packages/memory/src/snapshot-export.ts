import type { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { attempt, type Result } from '@ticrafter/core';
import { StorageFailures, type StorageFailure } from './failures.js';

export class SnapshotExporter {
    constructor(private readonly db: Database) {}

    async export(destination: string): Promise<Result<void, StorageFailure>> {
        const [, error] = attempt(() => {
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, this.db.serialize());
        });
        if (error) {
            return [null, StorageFailures.from('SNAPSHOT_EXPORT_FAILED', error)];
        }

        return [undefined, null];
    }
}

import type { Database } from 'bun:sqlite';
import { attempt, type Result } from '@ticrafter/core';
import { StorageFailures, type StorageFailure } from './failures.js';

export class TransactionManager {
    constructor(private readonly db: Database) {}

    run<T>(operation: () => T): Result<T, StorageFailure> {
        const [value, error] = attempt(() => this.db.transaction(operation)());
        if (error) {
            return [null, StorageFailures.from('TRANSACTION_FAILED', error)];
        }

        return [value, null];
    }
}

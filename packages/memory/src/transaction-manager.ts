import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export class TransactionManager {
    constructor(private readonly database: Database) {}

    run<T>(operation: () => T): Result<T, StorageFailure> {
        const [value, error] = attempt(() => this.database.transaction(operation)());
        if (error) {
            return [null, StorageFailures.from('TRANSACTION_FAILED', error)];
        }

        return [value, null];
    }
}

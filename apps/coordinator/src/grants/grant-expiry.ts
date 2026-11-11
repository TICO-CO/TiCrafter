import type { Result } from '@ticrafter/core';
import type { TransactionManager } from '@ticrafter/memory';

import type { EditGrantRepository } from './grant-repository.js';
import type { EditGrantRecord, GrantFailure } from './types.js';

export class GrantExpiry {
    constructor(
        private readonly repository: EditGrantRepository,
        private readonly transactions: TransactionManager,
    ) {}

    expire(now = new Date().toISOString()): Result<readonly EditGrantRecord[], GrantFailure> {
        const [expired, listError] = this.repository.listExpired(now);
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (expired === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'grants missing' }];
        }
        const [result, transactionError] = this.transactions.run<
            Result<EditGrantRecord[], GrantFailure>
        >(() => this.expireAll(expired, now));
        if (transactionError) return [null, { type: 'STORAGE', failure: transactionError }];
        if (result === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'transaction returned null' }];
        }
        return result;
    }

    private expireAll(
        expired: readonly EditGrantRecord[],
        now: string,
    ): Result<EditGrantRecord[], GrantFailure> {
        const records: EditGrantRecord[] = [];
        for (const grant of expired) {
            const record: EditGrantRecord = {
                ...grant,
                status: 'expired',
                fencingToken: grant.fencingToken + 1,
                updatedAt: now,
            };
            const [, updateError] = this.repository.update(record);
            if (updateError) return [null, { type: 'STORAGE', failure: updateError }];
            records.push(record);
        }
        return [records, null];
    }
}

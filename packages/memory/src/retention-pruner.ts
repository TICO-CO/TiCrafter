import type { Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import type { StorageFailure } from './failures.js';
import { TransactionManager } from './transaction-manager.js';

export interface RetentionResult {
    events: number;
    blockChanges: number;
}

export class RetentionPruner {
    constructor(private readonly database: Database) {}

    prune(retentionDays: number, now: Date = new Date()): Result<RetentionResult, StorageFailure> {
        const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

        return new TransactionManager(this.database).run(() => {
            const events = this.database
                .prepare('DELETE FROM bot_events WHERE created_at < ?')
                .run(cutoff).changes;
            const blockChanges = this.database
                .prepare('DELETE FROM block_changelog WHERE created_at < ?')
                .run(cutoff).changes;
            return { events: Number(events), blockChanges: Number(blockChanges) };
        });
    }
}

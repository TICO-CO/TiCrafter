import type { Database } from 'bun:sqlite';
import type { Result } from '@ticrafter/core';
import type { StorageFailure } from './failures.js';
import { TransactionManager } from './transaction-manager.js';

export interface RetentionResult {
    events: number;
    blockChanges: number;
}

export class RetentionPruner {
    constructor(private readonly db: Database) {}

    prune(retentionDays: number, now: Date = new Date()): Result<RetentionResult, StorageFailure> {
        const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

        return new TransactionManager(this.db).run(() => {
            const events = this.db
                .prepare('DELETE FROM bot_events WHERE created_at < ?')
                .run(cutoff).changes;
            const blockChanges = this.db
                .prepare('DELETE FROM block_changelog WHERE created_at < ?')
                .run(cutoff).changes;
            return { events: Number(events), blockChanges: Number(blockChanges) };
        });
    }
}

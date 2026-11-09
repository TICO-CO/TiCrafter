import { attempt, type Result } from '@ticrafter/core';
import type { SqliteRuntime, StorageFailure } from '@ticrafter/memory';

export type CoordinatorDatabase = NonNullable<ReturnType<SqliteRuntime['open']>[0]>;

interface EpochRow {
    epoch: number;
}

export class EpochStore {
    constructor(private readonly db: CoordinatorDatabase) {}

    bump(): Result<number, StorageFailure> {
        const now = new Date().toISOString();
        return attempt<number, StorageFailure>(() => {
            const row = this.db.prepare('SELECT epoch FROM coordinator_state WHERE id = 1').get() as
                | EpochRow
                | undefined;
            const next = (row?.epoch ?? 0) + 1;
            this.db
                .prepare(
                    `INSERT INTO coordinator_state (id, epoch, updated_at) VALUES (1, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET epoch = excluded.epoch, updated_at = excluded.updated_at`,
                )
                .run(next, now);
            return next;
        });
    }

    current(): Result<number, StorageFailure> {
        return attempt<number, StorageFailure>(() => {
            const row = this.db.prepare('SELECT epoch FROM coordinator_state WHERE id = 1').get() as
                | EpochRow
                | undefined;
            return row?.epoch ?? 0;
        });
    }
}

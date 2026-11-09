import { attempt, type Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import type { CoordinatorDatabase } from './epoch.js';

export interface RecoveryReport {
    claims: number;
    grants: number;
}

export class RestartRecovery {
    constructor(private readonly db: CoordinatorDatabase) {}

    run(): Result<RecoveryReport, StorageFailure> {
        const now = new Date().toISOString();
        return attempt<RecoveryReport, StorageFailure>(() => {
            const claims = this.db.prepare('DELETE FROM claims WHERE lease_expires_at < ?').run(now)
                .changes;
            const grants = this.db
                .prepare(
                    "UPDATE edit_grants SET status = 'expired' WHERE expires_at < ? AND status IN ('issued', 'active')",
                )
                .run(now).changes;
            return { claims: Number(claims), grants: Number(grants) };
        });
    }
}

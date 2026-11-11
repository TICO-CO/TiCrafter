import { attempt, type Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { CoordinatorDatabase } from './epoch.js';

export interface RecoveryReport {
    claims: number;
    grants: number;
    tasks: number;
    bots: number;
}

export class RestartRecovery {
    constructor(
        private readonly database: CoordinatorDatabase,
        private readonly epoch: number,
    ) {}

    run(): Result<RecoveryReport, StorageFailure> {
        const now = new Date().toISOString();
        return attempt<RecoveryReport, StorageFailure>(() => {
            const claims = this.database
                .prepare(
                    `UPDATE claims SET status = 'expired', fencing_token = fencing_token + 1,
                        updated_at = ?
                     WHERE status = 'active' AND lease_expires_at < ?`,
                )
                .run(now, now).changes;
            const expiredGrants = this.database
                .prepare(
                    `UPDATE edit_grants SET status = 'expired', fencing_token = fencing_token + 1,
                        updated_at = ?
                     WHERE expires_at < ? AND status = 'active'`,
                )
                .run(now, now).changes;
            const staleGrants = this.database
                .prepare(
                    `UPDATE edit_grants SET status = 'revoked', fencing_token = fencing_token + 1,
                        updated_at = ?
                     WHERE epoch <> ? AND status = 'active'`,
                )
                .run(now, this.epoch).changes;
            const grants = Number(expiredGrants) + Number(staleGrants);
            const bots = this.database
                .prepare(
                    `UPDATE bots SET status = 'offline', updated_at = ?
                     WHERE status = 'online'`,
                )
                .run(now).changes;
            const tasks = this.database
                .prepare(
                    `UPDATE tasks SET status = 'ready', claimed_by = NULL, lease_until = NULL,
                        lease_token = NULL, available_at = ?, updated_at = ?
                     WHERE status IN ('claimed', 'running')
                       AND (
                           lease_until < ?
                           OR id IN (
                               SELECT task_id FROM claims
                               WHERE status = 'expired' AND task_id IS NOT NULL
                           )
                       )`,
                )
                .run(now, now, now).changes;
            return {
                claims: Number(claims),
                grants: Number(grants),
                tasks: Number(tasks),
                bots: Number(bots),
            };
        });
    }
}

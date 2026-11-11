import type { Result } from '@ticrafter/core';

import type { EditGrantRepository } from './grant-repository.js';
import type { EditGrantRecord, GrantFailure } from './types.js';

export class GrantRevoker {
    constructor(private readonly repository: EditGrantRepository) {}

    revoke(grantId: string, now = new Date().toISOString()): Result<EditGrantRecord, GrantFailure> {
        const [grant, readError] = this.repository.get(grantId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (grant === null) return [null, { type: 'GRANT_NOT_FOUND', grantId }];
        if (grant.status !== 'active') {
            return [null, { type: 'INVALID_STATUS', grantId, status: grant.status }];
        }
        const revoked: EditGrantRecord = {
            ...grant,
            status: 'revoked',
            fencingToken: grant.fencingToken + 1,
            updatedAt: now,
        };
        const [, updateError] = this.repository.update(revoked);
        if (updateError) return [null, { type: 'STORAGE', failure: updateError }];
        return [revoked, null];
    }
}

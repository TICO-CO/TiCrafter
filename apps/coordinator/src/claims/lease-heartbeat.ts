import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
import type { ClaimFailure, ClaimRecord, ClaimSessionPort } from './types.js';

export class ClaimLeaseHeartbeat {
    constructor(
        private readonly repository: ClaimRepository,
        private readonly sessions: ClaimSessionPort,
    ) {}

    renew(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
        leaseTtlMilliseconds = 30_000,
    ): Result<ClaimRecord, ClaimFailure> {
        const [claim, readError] = this.repository.get(claimId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (claim === null) return [null, { type: 'CLAIM_NOT_FOUND', claimId }];
        if (claim.status !== 'active') {
            return [null, { type: 'INVALID_STATUS', claimId, status: claim.status }];
        }
        if (claim.botId !== botId) return [null, { type: 'OWNER_MISMATCH', claimId, botId }];
        if (claim.fencingToken !== fencingToken) {
            return [
                null,
                {
                    type: 'STALE_TOKEN',
                    claimId,
                    expected: claim.fencingToken,
                    actual: fencingToken,
                },
            ];
        }
        if (!this.sessions.isConnected(botId)) {
            return [null, { type: 'SESSION_INVALID', botId }];
        }
        const renewed: ClaimRecord = {
            ...claim,
            leaseUntil: new Date(Date.parse(now) + leaseTtlMilliseconds).toISOString(),
            updatedAt: now,
        };
        const [, updateError] = this.repository.update(renewed);
        if (updateError) return [null, { type: 'STORAGE', failure: updateError }];
        return [renewed, null];
    }
}

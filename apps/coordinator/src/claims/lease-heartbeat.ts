import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
import { ClaimFailures } from './failures.js';
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
        if (readError) return [null, ClaimFailures.storage(readError)];
        if (claim === null) return [null, ClaimFailures.claimNotFound(claimId)];
        if (claim.status !== 'active') {
            return [null, ClaimFailures.invalidStatus(claimId, claim.status)];
        }
        if (claim.botId !== botId) return [null, ClaimFailures.ownerMismatch(claimId, botId)];
        if (claim.fencingToken !== fencingToken) {
            return [null, ClaimFailures.staleToken(claimId, claim.fencingToken, fencingToken)];
        }
        if (!this.sessions.isConnected(botId)) {
            return [null, ClaimFailures.sessionInvalid(botId)];
        }
        const renewed: ClaimRecord = {
            ...claim,
            leaseUntil: new Date(Date.parse(now) + leaseTtlMilliseconds).toISOString(),
            updatedAt: now,
        };
        const [, updateError] = this.repository.update(renewed);
        if (updateError) return [null, ClaimFailures.storage(updateError)];
        return [renewed, null];
    }
}

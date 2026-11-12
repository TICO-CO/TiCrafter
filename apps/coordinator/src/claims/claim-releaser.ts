import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
import type { ClaimContentionMetrics } from './contention-metrics.js';
import { ClaimFailures } from './failures.js';
import type { ClaimFailure, ClaimRecord, ClaimStatus, ClaimTaskPort } from './types.js';

export class ClaimReleaser {
    constructor(
        private readonly repository: ClaimRepository,
        private readonly tasks: ClaimTaskPort,
        private readonly metrics: ClaimContentionMetrics,
    ) {}

    release(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        return this.finish(claimId, botId, fencingToken, 'released', now);
    }

    complete(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        return this.finish(claimId, botId, fencingToken, 'completed', now);
    }

    private finish(
        claimId: string,
        botId: string,
        fencingToken: number,
        status: ClaimStatus,
        now: string,
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
        if (status === 'released' && claim.taskId !== null) {
            const [, requeueError] = this.tasks.requeue(
                claim.taskId,
                botId,
                `claim ${status}`,
                now,
            );
            if (requeueError) {
                return [null, ClaimFailures.taskRequeueFailed(claim.taskId, String(requeueError))];
            }
        }
        const released: ClaimRecord = {
            ...claim,
            status,
            fencingToken: claim.fencingToken + 1,
            updatedAt: now,
        };
        const [, updateError] = this.repository.update(released);
        if (updateError) return [null, ClaimFailures.storage(updateError)];
        this.metrics.recordLeaseChurn();
        return [released, null];
    }
}

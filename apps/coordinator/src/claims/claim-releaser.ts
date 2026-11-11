import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
import type { ClaimContentionMetrics } from './contention-metrics.js';
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
        if (status === 'released' && claim.taskId !== null) {
            const [, requeueError] = this.tasks.requeue(
                claim.taskId,
                botId,
                `claim ${status}`,
                now,
            );
            if (requeueError) {
                return [
                    null,
                    {
                        type: 'TASK_REQUEUE_FAILED',
                        taskId: claim.taskId,
                        message: String(requeueError),
                    },
                ];
            }
        }
        const released: ClaimRecord = {
            ...claim,
            status,
            fencingToken: claim.fencingToken + 1,
            updatedAt: now,
        };
        const [, updateError] = this.repository.update(released);
        if (updateError) return [null, { type: 'STORAGE', failure: updateError }];
        this.metrics.recordLeaseChurn();
        return [released, null];
    }
}

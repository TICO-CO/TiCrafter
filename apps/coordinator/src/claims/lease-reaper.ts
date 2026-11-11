import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
import type { ClaimContentionMetrics } from './contention-metrics.js';
import type { ClaimFailure, ClaimRecord, ClaimTaskPort } from './types.js';

export class ClaimLeaseReaper {
    constructor(
        private readonly repository: ClaimRepository,
        private readonly tasks: ClaimTaskPort,
        private readonly metrics: ClaimContentionMetrics,
    ) {}

    reap(now = new Date().toISOString()): Result<readonly ClaimRecord[], ClaimFailure> {
        const [expired, listError] = this.repository.listExpired(now);
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (expired === null) return [null, { type: 'MALFORMED_CLAIM', message: 'claims missing' }];
        const reaped: ClaimRecord[] = [];
        for (const claim of expired) {
            if (claim.taskId !== null) {
                const [, requeueError] = this.tasks.requeue(
                    claim.taskId,
                    'lease-reaper',
                    'claim lease expired',
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
            const expiredClaim: ClaimRecord = {
                ...claim,
                status: 'expired',
                fencingToken: claim.fencingToken + 1,
                updatedAt: now,
            };
            const [, updateError] = this.repository.update(expiredClaim);
            if (updateError) return [null, { type: 'STORAGE', failure: updateError }];
            this.metrics.recordReclaim();
            reaped.push(expiredClaim);
        }
        return [reaped, null];
    }
}

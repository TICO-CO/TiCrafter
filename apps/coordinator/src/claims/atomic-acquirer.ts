import type { Result } from '@ticrafter/core';
import type { TransactionManager } from '@ticrafter/memory';

import type { ClaimRepository } from './claim-repository.js';
import { ClaimFailures } from './failures.js';
import type { FencingTokenAuthority } from './fencing-token-authority.js';
import { ClaimOverlapChecker } from './overlap-margin-checker.js';
import type { AcquireClaimInput, ClaimFailure, ClaimRecord } from './types.js';

export class AtomicClaimAcquirer {
    constructor(
        private readonly repository: ClaimRepository,
        private readonly authority: FencingTokenAuthority,
        private readonly transactions: TransactionManager,
        private readonly overlapMargin = 1,
        private readonly defaultLeaseTtlMilliseconds = 30_000,
    ) {}

    acquire(
        input: AcquireClaimInput,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        const [result, transactionError] = this.transactions.run<Result<ClaimRecord, ClaimFailure>>(
            () => this.acquireInside(input, now),
        );
        if (transactionError) return [null, ClaimFailures.storage(transactionError)];
        if (result === null) {
            return [null, ClaimFailures.invalidClaim('transaction returned null')];
        }
        const [claim, claimError] = result;
        if (claimError) return [null, claimError];
        return [claim, null];
    }

    private acquireInside(
        input: AcquireClaimInput,
        now: string,
    ): Result<ClaimRecord, ClaimFailure> {
        if (
            input.id.trim().length === 0 ||
            input.resourceId.trim().length === 0 ||
            input.botId.trim().length === 0
        ) {
            return [null, ClaimFailures.invalidClaim('claim identity is required')];
        }
        const [existing, existingError] = this.repository.get(input.id);
        if (existingError) return [null, ClaimFailures.storage(existingError)];
        if (existing !== null) {
            return [null, ClaimFailures.invalidClaim(`duplicate claim ${input.id}`)];
        }
        const [active, activeError] = this.repository.listActive();
        if (activeError) return [null, ClaimFailures.storage(activeError)];
        if (active === null) return [null, ClaimFailures.malformedClaim('claims missing')];
        const [, overlapError] = ClaimOverlapChecker.check(
            input.bbox,
            active,
            this.overlapMargin,
            null,
            input.parentClaimId ?? null,
        );
        if (overlapError) return [null, overlapError];
        const [token, tokenError] = this.authority.next();
        if (tokenError) return [null, tokenError];
        if (token === null) {
            return [null, ClaimFailures.malformedClaim('fencing token missing')];
        }
        const ttl = input.leaseTtlMilliseconds ?? this.defaultLeaseTtlMilliseconds;
        if (!Number.isFinite(ttl) || ttl <= 0) {
            return [null, ClaimFailures.invalidClaim('invalid lease ttl')];
        }
        const record: ClaimRecord = {
            id: input.id,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            bbox: input.bbox,
            botId: input.botId,
            leaseUntil: new Date(Date.parse(now) + ttl).toISOString(),
            fencingToken: token,
            status: 'active',
            taskId: input.taskId ?? null,
            parentClaimId: input.parentClaimId ?? null,
            epoch: this.authority.epoch,
            payload: input.payload ?? {},
            createdAt: now,
            updatedAt: now,
        };
        const [, insertError] = this.repository.insert(record);
        if (insertError) return [null, ClaimFailures.storage(insertError)];
        return [record, null];
    }
}

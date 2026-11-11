import type { Result } from '@ticrafter/core';
import type { TransactionManager } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { AtomicClaimAcquirer } from './atomic-acquirer.js';
import { ClaimReleaser } from './claim-releaser.js';
import { ClaimRepository as SqliteClaimRepository } from './claim-repository.js';
import { ClaimContentionMetrics } from './contention-metrics.js';
import { FencingTokenAuthority } from './fencing-token-authority.js';
import { ClaimLeaseHeartbeat } from './lease-heartbeat.js';
import { ClaimLeaseReaper } from './lease-reaper.js';
import { ClaimOverlapChecker } from './overlap-margin-checker.js';
import type {
    AcquireClaimInput,
    ClaimContentionSnapshot,
    ClaimFailure,
    ClaimRecord,
    ClaimSessionPort,
    ClaimTaskPort,
} from './types.js';

export interface ClaimServiceOptions {
    database: CoordinatorDatabase;
    transactions: TransactionManager;
    sessions: ClaimSessionPort;
    tasks: ClaimTaskPort;
    epoch: number;
    overlapMargin?: number;
    leaseTtlMilliseconds?: number;
}

export class ClaimService {
    private readonly repository: SqliteClaimRepository;
    private readonly acquirer: AtomicClaimAcquirer;
    private readonly heartbeat: ClaimLeaseHeartbeat;
    private readonly reaper: ClaimLeaseReaper;
    private readonly releaser: ClaimReleaser;
    private readonly metrics = new ClaimContentionMetrics();

    constructor(private readonly options: ClaimServiceOptions) {
        this.repository = new SqliteClaimRepository(options.database);
        const authority = new FencingTokenAuthority(this.repository, options.epoch);
        this.acquirer = new AtomicClaimAcquirer(
            this.repository,
            authority,
            options.transactions,
            options.overlapMargin,
            options.leaseTtlMilliseconds,
        );
        this.heartbeat = new ClaimLeaseHeartbeat(this.repository, options.sessions);
        this.reaper = new ClaimLeaseReaper(this.repository, options.tasks, this.metrics);
        this.releaser = new ClaimReleaser(this.repository, options.tasks, this.metrics);
    }

    acquire(
        input: AcquireClaimInput,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        const startedAt = Date.now();
        const [claim, claimError] = this.acquirer.acquire(input, now);
        this.metrics.recordWait(Date.now() - startedAt);
        if (claimError?.type === 'OVERLAP') this.metrics.recordDuplicateAttempt();
        return [claim, claimError];
    }

    renew(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        return this.heartbeat.renew(
            claimId,
            botId,
            fencingToken,
            now,
            this.options.leaseTtlMilliseconds,
        );
    }

    release(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        return this.releaser.release(claimId, botId, fencingToken, now);
    }

    complete(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        return this.releaser.complete(claimId, botId, fencingToken, now);
    }

    reapExpired(now = new Date().toISOString()): Result<readonly ClaimRecord[], ClaimFailure> {
        return this.reaper.reap(now);
    }

    listActive(): Result<readonly ClaimRecord[], ClaimFailure> {
        const [claims, claimError] = this.repository.listActive();
        if (claimError) return [null, { type: 'STORAGE', failure: claimError }];
        return [claims, null];
    }

    hasActiveOverlap(bbox: ClaimRecord['bbox']): Result<boolean, string> {
        const [active, activeError] = this.repository.listActive();
        if (activeError) return [null, activeError.message];
        if (active === null) return [null, 'claims missing'];
        const [, overlapError] = ClaimOverlapChecker.check(
            bbox,
            active,
            this.options.overlapMargin ?? 1,
        );
        if (overlapError === null) return [false, null];
        if (overlapError.type === 'OVERLAP') return [true, null];
        return [null, overlapError.type];
    }

    get contention(): ClaimContentionSnapshot {
        return this.metrics.snapshot();
    }
}

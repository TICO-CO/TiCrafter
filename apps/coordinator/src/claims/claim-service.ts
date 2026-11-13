import type { Result } from '@ticrafter/core';
import type { TransactionManager } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { SipGeometry } from '../sip/index.js';
import { AtomicClaimAcquirer } from './atomic-acquirer.js';
import { ClaimReleaser } from './claim-releaser.js';
import { ClaimRepository as SqliteClaimRepository } from './claim-repository.js';
import { ClaimContentionMetrics } from './contention-metrics.js';
import { ClaimFailures } from './failures.js';
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

    renewCoordinated(
        claimId: string,
        fencingToken: number,
        now = new Date().toISOString(),
        leaseTtlMilliseconds = this.options.leaseTtlMilliseconds ?? 30_000,
    ): Result<ClaimRecord, ClaimFailure> {
        const [claim, readError] = this.repository.get(claimId);
        if (readError) return [null, ClaimFailures.storage(readError)];
        if (claim === null) return [null, ClaimFailures.claimNotFound(claimId)];
        if (claim.status !== 'active') {
            return [null, ClaimFailures.invalidStatus(claimId, claim.status)];
        }
        if (claim.fencingToken !== fencingToken) {
            return [null, ClaimFailures.staleToken(claimId, claim.fencingToken, fencingToken)];
        }
        if (claim.resourceType !== 'work_package') {
            return [
                null,
                ClaimFailures.invalidClaim('coordinated renewal requires a work package'),
            ];
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

    release(
        claimId: string,
        botId: string,
        fencingToken: number,
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        return this.releaser.release(claimId, botId, fencingToken, now);
    }

    authorizeScope(
        input: {
            claimId: string;
            fencingToken: number;
            position: { x: number; y: number; z: number };
            structureId: string;
            workPackageId?: string;
        },
        now = new Date().toISOString(),
    ): Result<ClaimRecord, ClaimFailure> {
        const [claim, readError] = this.repository.get(input.claimId);
        if (readError) return [null, ClaimFailures.storage(readError)];
        if (claim === null) return [null, ClaimFailures.claimNotFound(input.claimId)];
        if (claim.status !== 'active') {
            return [null, ClaimFailures.invalidStatus(claim.id, claim.status)];
        }
        if (claim.leaseUntil <= now) {
            return [null, ClaimFailures.invalidStatus(claim.id, 'expired')];
        }
        if (claim.fencingToken !== input.fencingToken) {
            return [
                null,
                ClaimFailures.staleToken(claim.id, claim.fencingToken, input.fencingToken),
            ];
        }
        const structureMatches =
            claim.resourceId === input.structureId ||
            claim.payload.structureId === input.structureId ||
            this.parentStructureMatches(claim, input.structureId);
        if (!structureMatches) {
            return [null, ClaimFailures.invalidClaim('claim structure mismatch')];
        }
        if (input.workPackageId !== undefined && claim.resourceId !== input.workPackageId) {
            return [null, ClaimFailures.invalidClaim('claim package mismatch')];
        }
        if (!SipGeometry.contains(claim.bbox, SipGeometry.singleBlock(input.position))) {
            return [null, ClaimFailures.invalidClaim('claim does not cover position')];
        }
        return [claim, null];
    }

    private parentStructureMatches(claim: ClaimRecord, structureId: string): boolean {
        if (claim.parentClaimId === null) return false;
        const [parent, parentError] = this.repository.get(claim.parentClaimId);
        if (parentError || parent === null) return false;
        return parent.resourceId === structureId;
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
        if (claimError) return [null, ClaimFailures.storage(claimError)];
        return [claims, null];
    }

    ownersIn(bbox: ClaimRecord['bbox']): Result<readonly string[], ClaimFailure> {
        const [claims, claimsError] = this.activeClaimsIn(bbox);
        if (claimsError) return [null, claimsError];
        return [[...new Set((claims ?? []).map((claim) => claim.botId))], null];
    }

    activeClaimsIn(bbox: ClaimRecord['bbox']): Result<readonly ClaimRecord[], ClaimFailure> {
        const [active, activeError] = this.repository.listActive();
        if (activeError) return [null, ClaimFailures.storage(activeError)];
        if (active === null) return [null, ClaimFailures.malformedClaim('claims missing')];
        return [active.filter((claim) => ClaimService.intersects(bbox, claim.bbox)), null];
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

    private static intersects(left: ClaimRecord['bbox'], right: ClaimRecord['bbox']): boolean {
        return (
            left.min.x <= right.max.x &&
            left.max.x >= right.min.x &&
            left.min.y <= right.max.y &&
            left.max.y >= right.min.y &&
            left.min.z <= right.max.z &&
            left.max.z >= right.min.z
        );
    }

    get contention(): ClaimContentionSnapshot {
        return this.metrics.snapshot();
    }
}

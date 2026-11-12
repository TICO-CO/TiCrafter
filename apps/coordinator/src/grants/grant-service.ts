import type { Result } from '@ticrafter/core';
import type { TransactionManager } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import type { SipCommit, SipSnapshot, SipStructure } from '../sip/index.js';
import { GrantCompatibilityChecker } from './compatibility-checker.js';
import { DesignRevisionGuard } from './design-revision-guard.js';
import { GrantAuthorizer } from './grant-authorizer.js';
import { GrantExpiry } from './grant-expiry.js';
import { GrantIssuer } from './grant-issuer.js';
import { EditGrantRepository } from './grant-repository.js';
import { GrantRevoker } from './grant-revoker.js';
import { OwnerOfflinePolicy } from './owner-offline-policy.js';
import { CollaborationPolicyEvaluator } from './policy-evaluator.js';
import type {
    CompatibilityInput,
    EditGrantRecord,
    EditRequestInput,
    GrantClaimsPort,
    GrantFailure,
    GrantPresencePort,
    GrantSipPort,
} from './types.js';

export interface GrantServiceOptions {
    database: CoordinatorDatabase;
    transactions: TransactionManager;
    sip: GrantSipPort;
    claims: GrantClaimsPort;
    presence: GrantPresencePort;
    epoch: number;
    defaultTtlMilliseconds?: number;
}

export class GrantService {
    private readonly repository: EditGrantRepository;
    private readonly policy = new CollaborationPolicyEvaluator();
    private readonly compatibility = new GrantCompatibilityChecker();
    private readonly ownerOffline = new OwnerOfflinePolicy();
    private readonly guard = new DesignRevisionGuard();
    private readonly issuer: GrantIssuer;
    private readonly revoker: GrantRevoker;
    private readonly expiry: GrantExpiry;
    private readonly authorizer: GrantAuthorizer;

    constructor(private readonly options: GrantServiceOptions) {
        this.repository = new EditGrantRepository(options.database);
        this.issuer = new GrantIssuer(this.repository, {
            epoch: options.epoch,
            defaultTtlMilliseconds: options.defaultTtlMilliseconds,
        });
        this.revoker = new GrantRevoker(this.repository);
        this.expiry = new GrantExpiry(this.repository, options.transactions);
        this.authorizer = new GrantAuthorizer(
            this.repository,
            options.sip,
            (grant, structure) => this.guard.validate(grant, structure),
            options.epoch,
        );
    }

    request(
        input: EditRequestInput,
        now = new Date().toISOString(),
    ): Result<EditGrantRecord, GrantFailure> {
        const [snapshot, snapshotError] = this.options.sip.load();
        if (snapshotError) return [null, { type: 'STORAGE', failure: snapshotError }];
        if (snapshot === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'sip snapshot missing' }];
        }
        const structure =
            snapshot.structures.find((candidate) => candidate.id === input.structureId) ?? null;
        if (structure === null) {
            return [null, { type: 'STRUCTURE_NOT_FOUND', structureId: input.structureId }];
        }
        const [claims, claimsError] = this.options.claims.listActive();
        if (claimsError) return [null, { type: 'STORAGE', failure: claimsError }];
        if (claims === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active claims missing' }];
        }
        const isOwner = structure.ownerBotIds.includes(input.requesterBotId);
        const ownerOnline = this.isOwnerOnline(structure);
        const decision = this.policy.evaluate(structure, input.requesterBotId, ownerOnline);
        if (decision.kind === 'deny') {
            return [
                null,
                { type: 'POLICY_DENIED', reason: decision.reason, message: decision.message },
            ];
        }
        const compatibility = {
            structure,
            requesterBotId: input.requesterBotId,
            observedDesignRevision: input.observedDesignRevision,
            proposedOps: input.proposedOps,
            bbox: input.bbox,
            snapshot,
            claims,
            ...(input.allowClaimIds === undefined ? {} : { allowedClaimIds: input.allowClaimIds }),
        };
        if (decision.kind === 'owner-offline') {
            return this.issueOffline(input, structure, compatibility, now);
        }
        const [, compatibilityError] = this.compatibility.check({
            ...compatibility,
            allowCompletedWork: isOwner,
        });
        if (compatibilityError) return [null, compatibilityError];
        return this.issuer.issue(input, structure, decision.grantedBy, now);
    }

    authorize(
        input: Parameters<GrantAuthorizer['authorize']>[0],
        now = new Date().toISOString(),
    ): Result<EditGrantRecord, GrantFailure> {
        return this.authorizer.authorize(input, now);
    }

    listActive(): Result<readonly EditGrantRecord[], GrantFailure> {
        const [grants, listError] = this.repository.listActive();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (grants === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active grants missing' }];
        }
        return [grants, null];
    }

    listActiveForBot(
        botId: string,
        now = new Date().toISOString(),
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const [grants, listError] = this.listActive();
        if (listError) return [null, listError];
        if (grants === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active grants missing' }];
        }
        return [
            grants.filter(
                (grant) =>
                    grant.epoch === this.options.epoch &&
                    grant.granteeBotId === botId &&
                    grant.expiresAt > now,
            ),
            null,
        ];
    }

    revoke(grantId: string, now = new Date().toISOString()): Result<EditGrantRecord, GrantFailure> {
        return this.revoker.revoke(grantId, now);
    }

    revokeForTask(
        taskId: string,
        now = new Date().toISOString(),
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const [active, listError] = this.repository.listActive();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (active === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active grants missing' }];
        }
        return this.revokeMatching(active, now, (grant) => grant.taskId === taskId);
    }

    revokeForStructure(
        structureId: string,
        now = new Date().toISOString(),
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const [active, listError] = this.repository.listActiveForStructure(structureId);
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (active === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active grants missing' }];
        }
        return this.revokeMatching(active, now, () => true);
    }

    private revokeMatching(
        grants: readonly EditGrantRecord[],
        now: string,
        matches: (grant: EditGrantRecord) => boolean,
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const revoked: EditGrantRecord[] = [];
        for (const grant of grants) {
            if (!matches(grant)) continue;
            const [record, revokeError] = this.revoker.revoke(grant.id, now);
            if (revokeError) return [null, revokeError];
            if (record !== null) revoked.push(record);
        }
        return [revoked, null];
    }

    expire(now = new Date().toISOString()): Result<readonly EditGrantRecord[], GrantFailure> {
        return this.expiry.expire(now);
    }

    invalidateForStructure(
        structureId: string,
        designRevision: number,
        now = new Date().toISOString(),
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const [active, listError] = this.repository.listActiveForStructure(structureId);
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (active === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active grants missing' }];
        }
        return this.revokeStale(active, now, (grant) => grant.designRevision !== designRevision);
    }

    reconcileDesignRevisions(
        snapshot: SipSnapshot,
        now = new Date().toISOString(),
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const [active, listError] = this.repository.listActive();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (active === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'active grants missing' }];
        }
        return this.revokeStale(active, now, (grant) => this.guard.staleGrants(grant, snapshot));
    }

    handleSipCommit(commit: SipCommit, now = new Date().toISOString()): void {
        this.reconcileDesignRevisions(commit.snapshot, now);
    }

    private issueOffline(
        input: EditRequestInput,
        structure: SipStructure,
        compatibility: Omit<CompatibilityInput, 'allowCompletedWork'>,
        now: string,
    ): Result<EditGrantRecord, GrantFailure> {
        const [, compatibilityError] = this.compatibility.check({
            ...compatibility,
            allowCompletedWork: false,
        });
        const decision = this.ownerOffline.evaluate(structure, compatibilityError === null);
        if (decision.kind === 'deny') {
            return [
                null,
                { type: 'POLICY_DENIED', reason: decision.reason, message: decision.message },
            ];
        }
        return this.issuer.issue(input, structure, 'owner', now);
    }

    private revokeStale(
        grants: readonly EditGrantRecord[],
        now: string,
        stale: (grant: EditGrantRecord) => boolean,
    ): Result<readonly EditGrantRecord[], GrantFailure> {
        const revoked: EditGrantRecord[] = [];
        for (const grant of grants) {
            if (!stale(grant)) continue;
            const [record, revokeError] = this.revoker.revoke(grant.id, now);
            if (revokeError) return [null, revokeError];
            if (record !== null) revoked.push(record);
        }
        return [revoked, null];
    }

    private isOwnerOnline(structure: SipStructure): boolean {
        return structure.ownerBotIds.some((ownerBotId) =>
            this.options.presence.isOnline(ownerBotId),
        );
    }
}

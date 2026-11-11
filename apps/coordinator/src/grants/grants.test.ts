import { TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { ClaimRecord } from '../claims/index.js';
import type { CoordinatorDatabase } from '../core/index.js';
import { SipFixtures, type SipSnapshot } from '../sip/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { GrantService, type GrantServiceOptions } from './grant-service.js';
import type { EditRequestInput } from './types.js';

const now = '2026-11-11T10:00:00.000Z';
const later = '2026-11-11T10:00:02.000Z';

const shellBbox = {
    min: { x: -2, y: 64, z: -2 },
    max: { x: 2, y: 66, z: 2 },
};

const workPackage = (status: 'planned' | 'complete') => ({
    id: 'work-package.shell',
    bbox: shellBbox,
    status,
    claimedBy: null,
});

const structure = SipFixtures.structure({
    status: 'building',
    collaboration: 'open',
    designRevision: 3,
});

const snapshot = (overrides: Partial<SipSnapshot> = {}): SipSnapshot => ({
    ...SipFixtures.snapshot(),
    structures: [structure],
    ...overrides,
});

const request = (overrides: Partial<EditRequestInput> = {}): EditRequestInput => ({
    id: 'grant-1',
    structureId: structure.id,
    requesterBotId: 'bot.helper',
    observedDesignRevision: 3,
    intent: 'finish roof',
    proposedOps: ['place'],
    bbox: { min: { x: -1, y: 64, z: -1 }, max: { x: 1, y: 66, z: 1 } },
    ...overrides,
});

const claim = (overrides: Partial<ClaimRecord> = {}): ClaimRecord => ({
    id: 'claim-1',
    resourceType: 'work_package',
    resourceId: 'work-package.shell',
    bbox: { min: { x: -1, y: 64, z: -1 }, max: { x: 1, y: 66, z: 1 } },
    botId: 'bot.other',
    leaseUntil: later,
    fencingToken: 4,
    status: 'active',
    taskId: null,
    epoch: 7,
    payload: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
});

describe('GrantService', () => {
    const fresh = (
        options: Partial<GrantServiceOptions> & { activeClaims?: readonly ClaimRecord[] } = {},
    ): GrantService => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const activeClaims = options.activeClaims ?? [];
        return new GrantService({
            database: coordinatorDatabase,
            transactions: new TransactionManager(coordinatorDatabase),
            sip: { load: () => [options.sip === undefined ? snapshot() : snapshot(), null] },
            claims: { listActive: () => [activeClaims, null] },
            presence: { isOnline: () => true },
            epoch: 9,
            ...options,
        });
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('issues an open-collaboration grant', () => {
        const service = fresh();
        const [grant, grantError] = service.request(request(), now);
        expect(grantError).toBeNull();
        expect(grant?.status).toBe('active');
        expect(grant?.designRevision).toBe(3);
        expect(grant?.fencingToken).toBe(1);
        expect(grant?.epoch).toBe(9);
        expect(grant?.grantedBy).toBe('coordinator');
    });

    it('denies private structures to non-owners', () => {
        const service = fresh({
            sip: {
                load: () => [
                    snapshot({ structures: [{ ...structure, collaboration: 'private' }] }),
                    null,
                ],
            },
        });
        const [grant, grantError] = service.request(request(), now);
        expect(grant).toBeNull();
        expect(grantError?.type).toBe('POLICY_DENIED');
    });

    it('allows an owner to edit private completed work', () => {
        const privateStructure = {
            ...structure,
            collaboration: 'private' as const,
            workPackages: [workPackage('complete')],
        };
        const service = fresh({
            sip: { load: () => [snapshot({ structures: [privateStructure] }), null] },
        });
        const [grant, grantError] = service.request(request({ requesterBotId: 'bot.tibot1' }), now);
        expect(grantError).toBeNull();
        expect(grant?.grantedBy).toBe('owner');
    });

    it('evaluates invite policy for online and offline owners', () => {
        const invite = { ...structure, collaboration: 'invite' as const };
        const online = fresh({
            sip: { load: () => [snapshot({ structures: [invite] }), null] },
            presence: { isOnline: () => true },
        });
        const [grant, grantError] = online.request(request(), now);
        expect(grantError).toBeNull();
        expect(grant?.grantedBy).toBe('owner');

        const offline = fresh({
            sip: { load: () => [snapshot({ structures: [invite] }), null] },
            presence: { isOnline: () => false },
        });
        const [denied, deniedError] = offline.request(request(), now);
        expect(denied).toBeNull();
        expect(deniedError?.type).toBe('POLICY_DENIED');
    });

    it('allows offline owners to accept compatible helpers only when configured', () => {
        const invite = {
            ...structure,
            collaboration: 'invite' as const,
            autoAcceptCompatibleHelpers: true,
        };
        const service = fresh({
            sip: { load: () => [snapshot({ structures: [invite] }), null] },
            presence: { isOnline: () => false },
        });
        const [grant, grantError] = service.request(request(), now);
        expect(grantError).toBeNull();
        expect(grant?.grantedBy).toBe('owner');
    });

    it('rejects revision mismatch, claim collisions, and completed work', () => {
        const service = fresh();
        const [, revisionError] = service.request(
            request({ id: 'grant-revision', observedDesignRevision: 2 }),
            now,
        );
        expect(revisionError?.type).toBe('REVISION_MISMATCH');
        const [, claimError] = fresh({ activeClaims: [claim()] }).request(
            request({ id: 'grant-claim' }),
            now,
        );
        expect(claimError?.type).toBe('CLAIM_COLLISION');
        const completed = {
            ...structure,
            workPackages: [workPackage('complete')],
        };
        const [, completedError] = fresh({
            sip: { load: () => [snapshot({ structures: [completed] }), null] },
        }).request(request({ id: 'grant-completed' }), now);
        expect(completedError?.type).toBe('COMPLETED_WORK_COLLISION');
    });

    it('authorizes only live scoped grants', () => {
        const service = fresh();
        const [grant] = service.request(request({ ttlMilliseconds: 1000 }), now);
        const authorization = {
            grantId: 'grant-1',
            botId: 'bot.helper',
            fencingToken: grant?.fencingToken ?? 0,
            bbox: request().bbox,
            operations: ['place'] as const,
        };
        const [allowed, allowedError] = service.authorize(authorization, now);
        expect(allowedError).toBeNull();
        expect(allowed?.id).toBe('grant-1');
        const [, tokenError] = service.authorize(
            { ...authorization, fencingToken: (grant?.fencingToken ?? 0) + 1 },
            now,
        );
        expect(tokenError?.type).toBe('STALE_TOKEN');
        const [, operationError] = service.authorize(
            { ...authorization, operations: ['break'] },
            now,
        );
        expect(operationError?.type).toBe('OPERATION_NOT_GRANTED');
        const [, expiredError] = service.authorize(authorization, later);
        expect(expiredError?.type).toBe('GRANT_EXPIRED');
    });

    it('rejects grants issued in a previous coordinator epoch', () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const options: Omit<GrantServiceOptions, 'epoch'> = {
            database: coordinatorDatabase,
            transactions: new TransactionManager(coordinatorDatabase),
            sip: { load: () => [snapshot(), null] },
            claims: { listActive: () => [[], null] },
            presence: { isOnline: () => true },
        };
        const [grant] = new GrantService({ ...options, epoch: 9 }).request(request(), now);
        const restarted = new GrantService({ ...options, epoch: 10 });
        const [, authorizationError] = restarted.authorize(
            {
                grantId: 'grant-1',
                botId: 'bot.helper',
                fencingToken: grant?.fencingToken ?? 0,
                bbox: request().bbox,
                operations: ['place'],
            },
            now,
        );
        expect(authorizationError?.type).toBe('STALE_EPOCH');
    });

    it('revokes and expires grants with fencing-token bumps', () => {
        const service = fresh();
        service.request(request(), now);
        const [revoked, revokeError] = service.revoke('grant-1', now);
        expect(revokeError).toBeNull();
        expect(revoked?.status).toBe('revoked');
        expect(revoked?.fencingToken).toBe(2);

        service.request(request({ id: 'grant-2', ttlMilliseconds: 1000 }), now);
        const [expired, expireError] = service.expire(later);
        expect(expireError).toBeNull();
        expect(expired?.[0]?.status).toBe('expired');
        expect(expired?.[0]?.fencingToken).toBe(4);
    });

    it('revokes grants when the design revision changes', () => {
        const service = fresh();
        service.request(request(), now);
        const [revoked, revokeError] = service.reconcileDesignRevisions(
            snapshot({ structures: [{ ...structure, designRevision: 4 }] }),
            now,
        );
        expect(revokeError).toBeNull();
        expect(revoked).toHaveLength(1);
        expect(revoked?.[0]?.status).toBe('revoked');
    });
});

import type { BlockUpdateMessage } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { ClaimRecord, ClaimService } from '../claims/index.js';
import type { EditGrantRecord, GrantService } from '../grants/index.js';
import { SipFixtures, type SipSnapshot } from '../sip/index.js';
import { ConstructionEditAuthorizer } from './construction-edit-authorizer.js';

const now = '2026-11-11T10:00:00.000Z';
const structure = SipFixtures.structure({
    status: 'building',
    collaboration: 'open',
    designRevision: 3,
});
const snapshot: SipSnapshot = {
    ...SipFixtures.snapshot(),
    structures: [structure],
};

function claim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
    return {
        id: 'claim.package',
        resourceType: 'work_package',
        resourceId: 'work-package.shell',
        bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 66, z: 2 } },
        botId: 'bot.owner',
        leaseUntil: '2099-11-11T12:00:00.000Z',
        fencingToken: 4,
        status: 'active',
        taskId: null,
        parentClaimId: null,
        epoch: 7,
        payload: { structureId: structure.id, workPackageId: 'work-package.shell' },
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function grant(overrides: Partial<EditGrantRecord> = {}): EditGrantRecord {
    return {
        id: 'grant-1',
        structureId: structure.id,
        ownerBotId: 'bot.owner',
        granteeBotId: 'bot.helper',
        designRevision: 3,
        bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 66, z: 2 } },
        allowedOps: ['place', 'break'],
        materialConstraints: [],
        intent: 'finish shell',
        status: 'active',
        expiresAt: '2099-11-11T12:00:00.000Z',
        fencingToken: 2,
        epoch: 7,
        grantedBy: 'owner',
        taskId: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function update(botId: string, withGrant = false): BlockUpdateMessage {
    return {
        botId,
        chunk: { x: 0, z: 0 },
        observedAt: now,
        block: {
            position: { x: 1, y: 64, z: 1 },
            blockId: 'stone',
            solid: true,
        },
        attribution: {
            structureId: structure.id,
            workPackageId: 'work-package.shell',
            claimId: 'claim.package',
            fencingToken: 4,
            ...(withGrant ? { grantId: 'grant-1', grantFencingToken: 2 } : {}),
        },
    };
}

function authorizer(
    options: {
        claims?: Partial<ClaimService>;
        grants?: Partial<GrantService>;
    } = {},
): ConstructionEditAuthorizer {
    return new ConstructionEditAuthorizer({
        claims: {
            listActive: () => [[], null],
            authorizeScope: () => [claim(), null],
            ...options.claims,
        } as unknown as ClaimService,
        grants: {
            listActiveForBot: () => [[], null],
            authorize: () => [grant(), null],
            ...options.grants,
        } as unknown as GrantService,
        sip: { loadSnapshot: () => [snapshot, null] },
    });
}

describe('ConstructionEditAuthorizer', () => {
    it('marks owner edits and helper edits', () => {
        expect(authorizer().authorize(update('bot.owner'), 'air')[0]).toEqual({
            authorized: true,
            via: 'owner',
        });
        const helper = authorizer({
            claims: {
                authorizeScope: () => [claim({ botId: 'bot.owner' }), null],
            },
            grants: { authorize: () => [grant({ granteeBotId: 'bot.helper' }), null] },
        });
        expect(helper.authorize(update('bot.helper', true), 'air')[0]).toEqual({
            authorized: true,
            via: 'helper',
        });
    });

    it('builds active claim and other-project claim safety context', () => {
        const [context, contextError] = authorizer({
            claims: {
                listActive: () => [
                    [
                        claim({ id: 'claim.active' }),
                        claim({ id: 'claim.other', botId: 'bot.other' }),
                        claim({ id: 'claim.self', botId: 'bot.helper' }),
                    ],
                    null,
                ],
            },
            grants: { listActiveForBot: () => [[grant()], null] },
        }).safetyContext('bot.helper', 'claim.active');

        expect(contextError).toBeNull();
        expect(context?.activeClaim?.id).toBe('claim.active');
        expect(context?.claims.map((entry) => entry.id)).toEqual(['claim.other']);
        expect(context?.grants.map((entry) => entry.id)).toEqual(['grant-1']);
    });
});

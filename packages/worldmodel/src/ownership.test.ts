import { describe, expect, it } from 'bun:test';

import {
    FarmPermissionPolicy,
    type OwnershipClaim,
    type OwnershipSourcePort,
    type PlayerConfidence,
    PlotOwnershipResolver,
} from './ownership.js';
import type { BoundingBox } from './types.js';

const plot: BoundingBox = {
    min: { x: 0, y: 63, z: 0 },
    max: { x: 4, y: 64, z: 4 },
};
const house: BoundingBox = {
    min: { x: -8, y: 64, z: -8 },
    max: { x: 8, y: 70, z: 8 },
};
const player: PlayerConfidence = {
    playerId: 'player.alex',
    username: 'Alex',
    score: 0.7,
    linkedBaseIds: ['base-1'],
    lastInteractionAt: null,
};

class FakeOwnership implements OwnershipSourcePort {
    selfId = 'bot.one';
    farmClaims: OwnershipClaim[] = [];
    house = { id: 'base-1', bbox: house };
    owners: string[] = [];
    linked: PlayerConfidence[] = [];

    activeFarmClaims(): readonly OwnershipClaim[] {
        return this.farmClaims;
    }
    nearestHouse(): { id: string; bbox: BoundingBox } | null {
        return this.house;
    }
    claimOwnersIn(): readonly string[] {
        return this.owners;
    }
    linkedPlayers(): readonly PlayerConfidence[] {
        return this.linked;
    }
}

describe('plot ownership resolver', () => {
    it('resolves self and other farm claims first', () => {
        const source = new FakeOwnership();
        source.farmClaims = [{ ownerId: 'bot.one', bbox: plot }];
        const resolver = new PlotOwnershipResolver(source, 32);
        expect(resolver.resolve(plot)[0]?.kind).toBe('self');
        source.farmClaims = [{ ownerId: 'bot.two', bbox: plot }];
        expect(resolver.resolve(plot)[0]).toEqual({ kind: 'other', ownerId: 'bot.two' });
    });

    it('resolves a base claim owner when no farm claim exists', () => {
        const source = new FakeOwnership();
        source.owners = ['bot.two'];
        const resolver = new PlotOwnershipResolver(source, 32);
        expect(resolver.resolve(plot)[0]).toEqual({ kind: 'other', ownerId: 'bot.two' });
    });

    it('returns linked players for an unclaimed base', () => {
        const source = new FakeOwnership();
        source.linked = [player];
        const resolver = new PlotOwnershipResolver(source, 32);
        const [ownership] = resolver.resolve(plot);
        expect(ownership?.kind).toBe('unknown');
        if (ownership?.kind !== 'unknown') return;
        expect(ownership.nearbyBaseId).toBe('base-1');
        expect(ownership.linkedPlayers[0]?.playerId).toBe('player.alex');
    });

    it('returns ambiguous when multiple owners conflict', () => {
        const source = new FakeOwnership();
        source.owners = ['bot.two', 'bot.three'];
        const resolver = new PlotOwnershipResolver(source, 32);
        const [ownership] = resolver.resolve(plot);
        expect(ownership?.kind).toBe('ambiguous');
    });
});

describe('farm permission policy', () => {
    const policy = new FarmPermissionPolicy();
    const unknown = {
        kind: 'unknown' as const,
        nearbyBaseId: 'base-1',
        linkedPlayers: [player],
    };

    it('allows self-owned and allowlisted plots', () => {
        expect(
            policy.decide({
                ownership: { kind: 'self', ownerId: 'bot.one' },
                plot,
                reply: null,
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }).decision,
        ).toBe('allow');
        expect(
            policy.decide({
                ownership: unknown,
                plot,
                reply: null,
                allowedRegions: [
                    {
                        id: 'farm',
                        bbox: {
                            min: { x: -8, y: 63, z: -8 },
                            max: { x: 8, y: 70, z: 8 },
                        },
                    },
                ],
                confidenceThreshold: 0.6,
            }),
        ).toEqual({ decision: 'allow', reason: 'allowlisted-region' });
    });

    it('asks for unknown plots with linked players', () => {
        expect(
            policy.decide({
                ownership: unknown,
                plot,
                reply: null,
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }),
        ).toEqual({ decision: 'ask', reason: 'unknown-owner' });
    });

    it('denies unlinked, low-confidence, and non-affirmative replies', () => {
        expect(
            policy.decide({
                ownership: unknown,
                plot,
                reply: {
                    player: { ...player, playerId: 'player.other' },
                    affirmative: true,
                },
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }).reason,
        ).toBe('unlinked-player');
        expect(
            policy.decide({
                ownership: unknown,
                plot,
                reply: { player: { ...player, score: 0.4 }, affirmative: true },
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }).reason,
        ).toBe('low-player-confidence');
        expect(
            policy.decide({
                ownership: unknown,
                plot,
                reply: { player, affirmative: false },
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }).reason,
        ).toBe('denied-by-player');
    });

    it('allows a trusted linked player affirmative', () => {
        expect(
            policy.decide({
                ownership: unknown,
                plot,
                reply: { player, affirmative: true },
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }),
        ).toEqual({ decision: 'allow', reason: 'trusted-player-grant' });
    });

    it('denies a known different owner regardless of reply', () => {
        expect(
            policy.decide({
                ownership: { kind: 'other', ownerId: 'bot.two' },
                plot,
                reply: { player, affirmative: true },
                allowedRegions: [],
                confidenceThreshold: 0.6,
            }).decision,
        ).toBe('deny');
    });
});

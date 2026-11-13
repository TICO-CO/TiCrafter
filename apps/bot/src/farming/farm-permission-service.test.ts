import {
    FarmPermissionPolicy,
    type PlayerConfidence,
    type PlotOwnership,
} from '@ticrafter/worldmodel';
import { describe, expect, it } from 'bun:test';

import { FarmPermissionService } from './farm-permission-service.js';

const plot = {
    id: 'plot.1',
    bbox: {
        min: { x: 0, y: 63, z: 0 },
        max: { x: 4, y: 64, z: 4 },
    },
};

const player: PlayerConfidence = {
    playerId: 'player.alex',
    username: 'Alex',
    score: 0.8,
    linkedBaseIds: ['base.1'],
    lastInteractionAt: null,
};

function ownership(overrides: Partial<PlotOwnership> = {}): PlotOwnership {
    return {
        kind: 'unknown',
        nearbyBaseId: 'base.1',
        linkedPlayers: [player],
        ...overrides,
    } as PlotOwnership;
}

function service(resolved: PlotOwnership, inquiries: string[] = []): FarmPermissionService {
    let now = 1_000;
    return new FarmPermissionService({
        policy: new FarmPermissionPolicy(),
        confidenceThreshold: 0.6,
        grantTtlMilliseconds: 600_000,
        askCooldownMilliseconds: 300_000,
        inquiryTimeoutMilliseconds: 60_000,
        ownership: async () => [resolved, null],
        inquiry: (plotId, usernames) => {
            inquiries.push(`${plotId}:${usernames.join(',')}`);
            return [undefined, null];
        },
        now: () => now,
        allowedRegions: () => [],
    });
}

describe('FarmPermissionService', () => {
    it('allows self-owned plots without asking', async () => {
        const inquiries: string[] = [];
        const permissions = service(ownership({ kind: 'self', ownerId: 'bot.one' }), inquiries);
        const [verdict, error] = await permissions.authorize(plot);
        expect(error).toBeNull();
        expect(verdict).toBe('allow');
        expect(inquiries).toEqual([]);
        expect(permissions.isPermitted(plot.id)).toBe(true);
        expect(permissions.consume(plot.id)).toBe(true);
    });

    it('allows allowlisted unknown plots without asking', async () => {
        const inquiries: string[] = [];
        const permissions = new FarmPermissionService({
            policy: new FarmPermissionPolicy(),
            confidenceThreshold: 0.6,
            grantTtlMilliseconds: 600_000,
            askCooldownMilliseconds: 300_000,
            inquiryTimeoutMilliseconds: 60_000,
            ownership: async () => [
                { kind: 'unknown', nearbyBaseId: null, linkedPlayers: [] },
                null,
            ],
            inquiry: (plotId, usernames) => {
                inquiries.push(`${plotId}:${usernames.join(',')}`);
                return [undefined, null];
            },
            now: () => 1_000,
            allowedRegions: () => [{ id: 'region.1', bbox: plot.bbox }],
        });
        expect((await permissions.authorize(plot))[0]).toBe('allow');
        expect(inquiries).toEqual([]);
    });

    it('asks linked high-confidence players once', async () => {
        const inquiries: string[] = [];
        const permissions = service(ownership(), inquiries);
        expect((await permissions.authorize(plot))[0]).toBe('ask');
        expect((await permissions.authorize(plot))[0]).toBe('ask');
        expect(inquiries).toEqual(['plot.1:Alex']);
    });

    it('grants after an affirmative linked reply and consumes once', async () => {
        const permissions = service(ownership());
        expect((await permissions.authorize(plot))[0]).toBe('ask');
        expect(permissions.handleReply('player.alex', 'yes')[0]).toBe(true);
        expect(permissions.isPermitted(plot.id)).toBe(true);
        expect(permissions.consume(plot.id)).toBe(true);
        expect(permissions.consume(plot.id)).toBe(false);
    });

    it('ignores unlinked players and denies negative replies', async () => {
        const permissions = service(ownership());
        await permissions.authorize(plot);
        expect(permissions.handleReply('player.other', 'yes')[0]).toBe(false);
        const denied = service(ownership());
        await denied.authorize(plot);
        expect(denied.handleReply('player.alex', 'no')[0]).toBe(true);
        expect(denied.isPermitted(plot.id)).toBe(false);
    });

    it('denies known different owners regardless of a reply', async () => {
        const permissions = service(ownership({ kind: 'other', ownerId: 'bot.two' }));
        expect((await permissions.authorize(plot))[0]).toBe('deny');
    });

    it('expires grants after their ttl', async () => {
        let now = 1_000;
        const permissions = new FarmPermissionService({
            policy: new FarmPermissionPolicy(),
            confidenceThreshold: 0.6,
            grantTtlMilliseconds: 1_000,
            askCooldownMilliseconds: 300_000,
            inquiryTimeoutMilliseconds: 60_000,
            ownership: async () => [ownership(), null],
            inquiry: () => [undefined, null],
            now: () => now,
            allowedRegions: () => [],
        });
        await permissions.authorize(plot);
        permissions.handleReply('player.alex', 'yes');
        expect(permissions.isPermitted(plot.id)).toBe(true);
        now += 1_000;
        expect(permissions.isPermitted(plot.id)).toBe(false);
    });
});

import type { Result } from '@ticrafter/core';

import type { BoundingBox } from './types.js';

export interface PlayerConfidence {
    playerId: string;
    username: string;
    score: number;
    linkedBaseIds: readonly string[];
    lastInteractionAt: string | null;
}

export type PlotOwnership =
    | { kind: 'self'; ownerId: string }
    | { kind: 'other'; ownerId: string }
    | { kind: 'ambiguous'; ownerIds: readonly string[]; nearbyBaseId: string | null }
    | {
          kind: 'unknown';
          nearbyBaseId: string | null;
          linkedPlayers: readonly PlayerConfidence[];
      };

export interface Region {
    id: string;
    bbox: BoundingBox;
}

export interface OwnershipClaim {
    ownerId: string;
    bbox: BoundingBox;
}

export interface OwnershipSourcePort {
    selfId: string;
    activeFarmClaims(plot: BoundingBox): readonly OwnershipClaim[];
    nearestHouse(plot: BoundingBox, radius: number): { id: string; bbox: BoundingBox } | null;
    claimOwnersIn(bbox: BoundingBox): readonly string[];
    linkedPlayers(baseId: string): readonly PlayerConfidence[];
}

export interface FarmPermissionInput {
    ownership: PlotOwnership;
    plot: BoundingBox;
    reply: { player: PlayerConfidence; affirmative: boolean } | null;
    allowedRegions: readonly Region[];
    confidenceThreshold: number;
}

export interface FarmPermissionDecision {
    decision: 'allow' | 'deny' | 'ask';
    reason: string;
}

export class PlotOwnershipResolver {
    constructor(
        private readonly source: OwnershipSourcePort,
        private readonly ownershipRadius: number,
    ) {}

    resolve(plot: BoundingBox): Result<PlotOwnership, string> {
        const farmClaims = this.source.activeFarmClaims(plot);
        if (farmClaims.length > 0) {
            const owners = [...new Set(farmClaims.map((claim) => claim.ownerId))];
            if (owners.length > 1) {
                return [
                    {
                        kind: 'ambiguous',
                        ownerIds: owners,
                        nearbyBaseId:
                            this.source.nearestHouse(plot, this.ownershipRadius)?.id ?? null,
                    },
                    null,
                ];
            }
            const ownerId = owners[0];
            if (ownerId === undefined) return [null, 'farm claim owner is missing'];
            return [
                ownerId === this.source.selfId
                    ? { kind: 'self', ownerId }
                    : { kind: 'other', ownerId },
                null,
            ];
        }
        const house = this.source.nearestHouse(plot, this.ownershipRadius);
        if (house === null) {
            return [{ kind: 'unknown', nearbyBaseId: null, linkedPlayers: [] }, null];
        }
        const claimOwners = [...new Set(this.source.claimOwnersIn(house.bbox))];
        if (claimOwners.length > 1) {
            return [{ kind: 'ambiguous', ownerIds: claimOwners, nearbyBaseId: house.id }, null];
        }
        const ownerId = claimOwners[0];
        if (ownerId !== undefined) {
            return [
                ownerId === this.source.selfId
                    ? { kind: 'self', ownerId }
                    : { kind: 'other', ownerId },
                null,
            ];
        }
        return [
            {
                kind: 'unknown',
                nearbyBaseId: house.id,
                linkedPlayers: this.source.linkedPlayers(house.id),
            },
            null,
        ];
    }
}

export class FarmPermissionPolicy {
    decide(input: FarmPermissionInput): FarmPermissionDecision {
        switch (input.ownership.kind) {
            case 'self':
                return { decision: 'allow', reason: 'self-owned' };
            case 'other':
                return { decision: 'deny', reason: 'other-owned' };
            case 'ambiguous':
                return { decision: 'deny', reason: 'ambiguous-owner' };
            case 'unknown':
                return this.unknown(input, input.ownership);
        }
    }

    private unknown(
        input: FarmPermissionInput,
        ownership: Extract<PlotOwnership, { kind: 'unknown' }>,
    ): FarmPermissionDecision {
        if (
            input.allowedRegions.some((region) =>
                FarmPermissionPolicy.contains(region.bbox, input.plot),
            )
        ) {
            return { decision: 'allow', reason: 'allowlisted-region' };
        }
        if (ownership.linkedPlayers.length === 0) {
            return { decision: 'deny', reason: 'no-linked-player' };
        }
        const reply = input.reply;
        if (reply === null) return { decision: 'ask', reason: 'unknown-owner' };
        const linked = ownership.linkedPlayers.some(
            (player) => player.playerId === reply.player.playerId,
        );
        if (!linked) return { decision: 'deny', reason: 'unlinked-player' };
        if (!reply.affirmative) return { decision: 'deny', reason: 'denied-by-player' };
        if (reply.player.score < input.confidenceThreshold) {
            return { decision: 'deny', reason: 'low-player-confidence' };
        }
        return { decision: 'allow', reason: 'trusted-player-grant' };
    }

    private static contains(region: BoundingBox, plot: BoundingBox): boolean {
        return (
            plot.min.x >= region.min.x &&
            plot.min.y >= region.min.y &&
            plot.min.z >= region.min.z &&
            plot.max.x <= region.max.x &&
            plot.max.y <= region.max.y &&
            plot.max.z <= region.max.z
        );
    }
}

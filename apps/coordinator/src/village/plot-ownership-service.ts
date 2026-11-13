import type { Result } from '@ticrafter/core';
import {
    type BoundingBox,
    type OwnershipClaim,
    type OwnershipSourcePort,
    type PlayerConfidence,
    type PlotOwnership,
    PlotOwnershipResolver,
} from '@ticrafter/worldmodel';

import type { ClaimService } from '../claims/index.js';
import type { PlayerConfidenceStore } from './player-confidence-store.js';

interface PlotOwnershipWorldPort {
    nearest(
        position: { x: number; y: number; z: number },
        type: 'house',
    ): Result<{ landmark: { id: string; bbox: BoundingBox }; distance: number } | null, unknown>;
}

export interface PlotOwnershipServiceOptions {
    claims: ClaimService;
    world: PlotOwnershipWorldPort;
    confidence: PlayerConfidenceStore;
    ownershipRadius: number;
    now?: () => string;
}

class CoordinatorOwnershipSource implements OwnershipSourcePort {
    constructor(
        private readonly options: PlotOwnershipServiceOptions,
        readonly selfId: string,
        private readonly now: string,
    ) {}

    get self(): string {
        return this.selfId;
    }

    activeFarmClaims(plot: BoundingBox): readonly OwnershipClaim[] {
        const [claims] = this.options.claims.activeClaimsIn(plot);
        return (claims ?? [])
            .filter((claim) => claim.resourceType === 'farm_plot')
            .map((claim) => ({ ownerId: claim.botId, bbox: claim.bbox }));
    }

    nearestHouse(plot: BoundingBox, radius: number): { id: string; bbox: BoundingBox } | null {
        const center = {
            x: (plot.min.x + plot.max.x) / 2,
            y: (plot.min.y + plot.max.y) / 2,
            z: (plot.min.z + plot.max.z) / 2,
        };
        const [nearest] = this.options.world.nearest(center, 'house');
        if (nearest === null) return null;
        if (nearest.distance > radius) return null;
        return { id: nearest.landmark.id, bbox: nearest.landmark.bbox };
    }

    claimOwnersIn(bbox: BoundingBox): readonly string[] {
        const [owners] = this.options.claims.ownersIn(bbox);
        return owners ?? [];
    }

    linkedPlayers(baseId: string): readonly PlayerConfidence[] {
        const [players] = this.options.confidence.linkedPlayers(baseId, this.now);
        return players ?? [];
    }
}

export class PlotOwnershipService {
    constructor(private readonly options: PlotOwnershipServiceOptions) {}

    resolve(
        selfId: string,
        plot: BoundingBox,
        now = this.options.now?.() ?? new Date().toISOString(),
    ): Result<PlotOwnership, string> {
        const source = new CoordinatorOwnershipSource(this.options, selfId, now);
        const resolver = new PlotOwnershipResolver(source, this.options.ownershipRadius);
        return resolver.resolve(plot);
    }
}

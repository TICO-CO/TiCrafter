import { type ActionRequest, assertNever, type Vec3 } from '@ticrafter/core';

import { SafetySignals } from './signals.js';
import type {
    RecoveryStep,
    SafetyBoundingBox,
    SafetyClaimRegion,
    SafetyGrantRegion,
    SafetySignal,
    SafetySnapshot,
} from './types.js';

export interface SafetyRuleResult {
    signal: SafetySignal;
    recovery: RecoveryStep;
}

export interface SafetyRule {
    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyRuleResult | null;
}

const BANNED_MATERIALS = new Set([
    'fire',
    'soul_fire',
    'lava',
    'flowing_lava',
    'tnt',
    'lava_bucket',
]);

export class MaterialBanRule implements SafetyRule {
    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyRuleResult | null {
        if (snapshot.allowDestructiveMaterials) return null;
        const material = this.materialFor(snapshot, request);
        if (material === null || !BANNED_MATERIALS.has(material)) return null;
        return {
            signal: SafetySignals.materialBan(material),
            recovery: { kind: 'safe-mode', reason: `banned material ${material}` },
        };
    }

    private materialFor(snapshot: SafetySnapshot, request: ActionRequest): string | null {
        const kind = request.kind;
        switch (kind) {
            case 'break-block':
                return snapshot.world.blockAt(request.position) ?? request.expectedBlockId ?? null;
            case 'place-block':
                return request.itemName;
            case 'move-to':
            case 'follow-path':
            case 'use-block':
            case 'look-at':
            case 'attack':
            case 'use-entity':
            case 'equip':
            case 'consume':
            case 'craft':
            case 'smelt':
            case 'collect-drops':
            case 'transfer':
            case 'wait':
                return null;
            default:
                return assertNever(kind);
        }
    }
}

export class ClaimBoundaryRule implements SafetyRule {
    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyRuleResult | null {
        const target = this.target(request);
        if (target === null) return null;
        const claims = snapshot.world
            .claims()
            .filter(
                (claim) =>
                    ClaimBoundaryRule.active(claim, snapshot.at) &&
                    ClaimBoundaryRule.contains(claim.bbox, target.position),
            );
        if (claims.some((claim) => claim.ownerBotId === snapshot.botId)) return null;
        const grant = snapshot.world
            .grants()
            .find(
                (candidate) =>
                    candidate.granteeBotId === snapshot.botId &&
                    ClaimBoundaryRule.active(candidate, snapshot.at) &&
                    ClaimBoundaryRule.contains(candidate.bbox, target.position),
            );
        if (grant !== undefined) {
            if (!grant.allowedOps.includes(target.operation)) {
                return {
                    signal: SafetySignals.grantScope(grant.id),
                    recovery: { kind: 'safe-mode', reason: `grant ${grant.id} operation denied` },
                };
            }
            return null;
        }
        const claim = claims[0];
        if (claim === undefined) return null;
        return {
            signal: SafetySignals.claimConflict(claim.id),
            recovery: { kind: 'safe-mode', reason: `claim ${claim.id} collision` },
        };
    }

    private target(
        request: ActionRequest,
    ): { operation: 'place' | 'break'; position: Vec3 } | null {
        const kind = request.kind;
        switch (kind) {
            case 'place-block':
                return { operation: 'place', position: request.position };
            case 'break-block':
                return { operation: 'break', position: request.position };
            case 'move-to':
            case 'follow-path':
            case 'use-block':
            case 'look-at':
            case 'attack':
            case 'use-entity':
            case 'equip':
            case 'consume':
            case 'craft':
            case 'smelt':
            case 'collect-drops':
            case 'transfer':
            case 'wait':
                return null;
            default:
                return assertNever(kind);
        }
    }

    private static active(region: SafetyClaimRegion | SafetyGrantRegion, at: string): boolean {
        const expiresAt = Date.parse(region.expiresAt);
        const evaluatedAt = Date.parse(at);
        if (!Number.isFinite(expiresAt) || !Number.isFinite(evaluatedAt)) return false;
        return expiresAt > evaluatedAt;
    }

    private static contains(bbox: SafetyBoundingBox, position: Vec3): boolean {
        return (
            position.x >= bbox.min.x &&
            position.x <= bbox.max.x &&
            position.y >= bbox.min.y &&
            position.y <= bbox.max.y &&
            position.z >= bbox.min.z &&
            position.z <= bbox.max.z
        );
    }
}

export class ProtectedBboxRule implements SafetyRule {
    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyRuleResult | null {
        const position = this.destructivePosition(request);
        if (position === null || !snapshot.world.isProtected(position)) return null;
        return {
            signal: SafetySignals.protectedRegion(),
            recovery: { kind: 'safe-mode', reason: 'protected region' },
        };
    }

    private destructivePosition(request: ActionRequest): Vec3 | null {
        const kind = request.kind;
        switch (kind) {
            case 'break-block':
            case 'place-block':
                return request.position;
            case 'move-to':
            case 'follow-path':
            case 'use-block':
            case 'look-at':
            case 'attack':
            case 'use-entity':
            case 'equip':
            case 'consume':
            case 'craft':
            case 'smelt':
            case 'collect-drops':
            case 'transfer':
            case 'wait':
                return null;
            default:
                return assertNever(kind);
        }
    }
}

export class ActiveBotSupportRule implements SafetyRule {
    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyRuleResult | null {
        if (request.kind !== 'break-block') return null;
        const supported = snapshot.world
            .activeBots()
            .some((activeBot) => this.supports(activeBot.position, request.position));
        if (!supported) return null;
        return {
            signal: SafetySignals.activeBotSupport(),
            recovery: { kind: 'safe-mode', reason: 'active bot support' },
        };
    }

    private supports(activeBotPosition: Vec3, blockPosition: Vec3): boolean {
        if (Math.floor(activeBotPosition.x) !== blockPosition.x) return false;
        if (Math.floor(activeBotPosition.z) !== blockPosition.z) return false;
        const verticalDistance = Math.floor(activeBotPosition.y) - blockPosition.y;
        return verticalDistance >= -1 && verticalDistance <= 2;
    }
}

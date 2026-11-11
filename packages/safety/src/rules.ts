import { type ActionRequest, assertNever, type Vec3 } from '@ticrafter/core';

import { SafetySignals } from './signals.js';
import type { RecoveryStep, SafetySignal, SafetySnapshot } from './types.js';

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
            case 'attack':
            case 'equip':
            case 'consume':
            case 'craft':
            case 'collect-drops':
            case 'transfer':
            case 'wait':
                return null;
            default:
                return assertNever(kind);
        }
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
            case 'attack':
            case 'equip':
            case 'consume':
            case 'craft':
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

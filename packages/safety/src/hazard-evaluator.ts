import type { Vec3 } from '@ticrafter/core';

import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

const LAVA_BLOCKS = new Set(['lava', 'flowing_lava']);
const FIRE_BLOCKS = new Set(['fire', 'soul_fire']);
const WATER_BLOCKS = new Set(['water', 'flowing_water']);
const FALL_DISTANCE_THRESHOLD = 4;

export class HazardEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const feet = this.blockAt(snapshot, snapshot.position);
        const head = this.blockAt(snapshot, {
            x: snapshot.position.x,
            y: snapshot.position.y + 1,
            z: snapshot.position.z,
        });
        const below = this.blockAt(snapshot, {
            x: snapshot.position.x,
            y: snapshot.position.y - 1,
            z: snapshot.position.z,
        });
        const signals: SafetySignal[] = [];
        if (this.hasAny(feet, below, LAVA_BLOCKS)) {
            signals.push(SafetySignals.hazardLava());
        }
        if (this.hasAny(feet, below, FIRE_BLOCKS)) {
            signals.push(SafetySignals.hazardFire());
        }
        if (this.hasAny(head, feet, WATER_BLOCKS) && snapshot.oxygen <= 4) {
            signals.push(SafetySignals.hazardDrowning());
        }
        if (snapshot.position.y < -60) {
            signals.push(SafetySignals.hazardVoid());
        }
        if (this.isFalling(snapshot)) {
            signals.push(SafetySignals.hazardFall());
        }
        return signals;
    }

    private isFalling(snapshot: SafetySnapshot): boolean {
        if (snapshot.falling === true) return true;
        return (snapshot.fallDistance ?? 0) >= FALL_DISTANCE_THRESHOLD;
    }

    private blockAt(snapshot: SafetySnapshot, position: Vec3): string | null {
        return snapshot.world.blockAt(position);
    }

    private hasAny(
        left: string | null,
        right: string | null,
        blocks: ReadonlySet<string>,
    ): boolean {
        return (left !== null && blocks.has(left)) || (right !== null && blocks.has(right));
    }
}

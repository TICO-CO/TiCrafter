import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class MobThreatEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const distance = snapshot.nearestHostileDistance;
        if (distance === null) return [];
        if (distance <= 4) {
            return [SafetySignals.mobAdjacent()];
        }
        if (distance <= 8) {
            return [SafetySignals.mobNearby()];
        }
        return [];
    }
}

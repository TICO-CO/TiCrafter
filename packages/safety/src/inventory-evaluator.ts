import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class InventoryEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (snapshot.inventoryTotalSlots <= 0) return [];
        const usedRatio = snapshot.inventoryUsedSlots / snapshot.inventoryTotalSlots;
        if (usedRatio < 0.9) return [];
        const percent = Math.round(usedRatio * 100);
        if (usedRatio >= 0.98) {
            return [SafetySignals.inventoryFullCritical(percent)];
        }
        return [SafetySignals.inventoryFullWarning(percent)];
    }
}

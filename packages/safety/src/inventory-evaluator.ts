import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class InventoryEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (snapshot.inventoryTotalSlots <= 0) return [];
        const usedRatio = snapshot.inventoryUsedSlots / snapshot.inventoryTotalSlots;
        if (usedRatio < 0.9) return [];
        return [
            {
                code: 'inventory.full',
                severity: usedRatio >= 0.98 ? 'critical' : 'warning',
                message: `inventory ${Math.round(usedRatio * 100)}% full`,
            },
        ];
    }
}

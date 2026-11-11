import { MobThreatRules } from '@ticrafter/core';

import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetyHostile, SafetySignal, SafetySnapshot } from './types.js';

export class MobThreatEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const rangedCritical = snapshot.hostiles.find((hostile) =>
            MobThreatRules.isRangedInRange(hostile),
        );
        if (rangedCritical !== undefined) {
            return [SafetySignals.mobRangedInRange(rangedCritical.name)];
        }
        const immediate = snapshot.hostiles.find((hostile) => MobThreatRules.isImmediate(hostile));
        if (immediate !== undefined) {
            return [SafetySignals.mobAdjacent()];
        }
        const rangedWarning = snapshot.hostiles.find((hostile) => this.isRangedWarning(hostile));
        if (rangedWarning !== undefined) {
            return [SafetySignals.mobRangedNearby(rangedWarning.name)];
        }
        const nearby = snapshot.hostiles.find(
            (hostile) => MobThreatRules.level(hostile) === 'warning',
        );
        if (nearby !== undefined) {
            return [SafetySignals.mobNearby()];
        }
        return [];
    }

    private isRangedWarning(hostile: SafetyHostile): boolean {
        return hostile.ranged && MobThreatRules.level(hostile) === 'warning';
    }
}

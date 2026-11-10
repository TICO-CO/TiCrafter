import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class MobThreatEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const distance = snapshot.nearestHostileDistance;
        if (distance === null) return [];
        if (distance <= 4) {
            return [{ code: 'mob.threat', severity: 'critical', message: 'hostile mob adjacent' }];
        }
        if (distance <= 8) {
            return [{ code: 'mob.threat', severity: 'warning', message: 'hostile mob nearby' }];
        }
        return [];
    }
}

import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class HungerEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (snapshot.food <= 2) {
            return [{ code: 'hunger.low', severity: 'critical', message: 'food critical' }];
        }
        if (snapshot.food <= 6) {
            return [{ code: 'hunger.low', severity: 'warning', message: 'food low' }];
        }
        return [];
    }
}

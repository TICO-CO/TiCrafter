import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class HungerEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (snapshot.food <= 2) {
            return [SafetySignals.foodCritical()];
        }
        if (snapshot.food <= 6) {
            return [SafetySignals.foodLow()];
        }
        return [];
    }
}

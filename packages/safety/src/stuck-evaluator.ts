import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class StuckTimeoutEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const signals: SafetySignal[] = [];
        if (snapshot.stuckMilliseconds >= 20_000) {
            signals.push(SafetySignals.movementStuck20s());
        } else if (snapshot.stuckMilliseconds >= 5_000) {
            signals.push(SafetySignals.movementStuck5s());
        }
        if (snapshot.targetUnreachableMilliseconds >= 10_000) {
            signals.push(SafetySignals.targetUnreachable10s());
        }
        return signals;
    }
}

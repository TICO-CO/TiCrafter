import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class StuckTimeoutEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const signals: SafetySignal[] = [];
        if (snapshot.stuckMilliseconds >= 15_000) {
            signals.push({
                code: 'movement.stuck',
                severity: 'critical',
                message: 'movement stuck for 15s',
            });
        } else if (snapshot.stuckMilliseconds >= 5_000) {
            signals.push({
                code: 'movement.stuck',
                severity: 'warning',
                message: 'movement stuck for 5s',
            });
        }
        if (snapshot.targetUnreachableMilliseconds >= 10_000) {
            signals.push({
                code: 'movement.unreachable',
                severity: 'warning',
                message: 'target unreachable for 10s',
            });
        }
        return signals;
    }
}

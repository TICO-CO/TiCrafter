import type { ActionRequest } from '@ticrafter/core';

import { ClaimLossEvaluator } from './claim-loss-evaluator.js';
import { EmergencyStopController } from './emergency-stop-controller.js';
import { RecoveryLadder } from './recovery-ladder.js';
import { SafetyPolicyEngine } from './safety-policy-engine.js';
import type { SafetyDecision, SafetySignal, SafetySnapshot } from './types.js';

export class ActionVetoGate {
    constructor(
        private readonly policy: SafetyPolicyEngine,
        private readonly emergencyStop: EmergencyStopController,
        private readonly claimLoss = new ClaimLossEvaluator(),
        private readonly recovery = new RecoveryLadder(),
    ) {}

    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyDecision {
        const signals = this.snapshotSignals(snapshot);
        const blocking = signals.find(
            (signal) => signal.severity === 'critical' || signal.code === 'claim.lost',
        );
        if (blocking) {
            return {
                allowed: false,
                reason: blocking.message,
                signals,
                recovery: this.recovery.next(signals),
            };
        }
        const ruleResult = this.policy.evaluate(snapshot, request);
        if (ruleResult) {
            return {
                allowed: false,
                reason: ruleResult.signal.message,
                signals: [ruleResult.signal],
                recovery: ruleResult.recovery,
            };
        }
        return { allowed: true, signals };
    }

    private snapshotSignals(snapshot: SafetySnapshot): readonly SafetySignal[] {
        const signals: SafetySignal[] = [...this.claimLoss.evaluate(snapshot)];
        if (this.emergencyStop.stopped) {
            signals.push({
                code: 'emergency-stop',
                severity: 'critical',
                message: this.emergencyStop.stopReason ?? 'emergency stop active',
            });
        }
        return signals;
    }
}

import type { ActionRequest } from '@ticrafter/core';

import { ClaimLossEvaluator } from './claim-loss-evaluator.js';
import { EmergencyStopController } from './emergency-stop-controller.js';
import { RecoveryLadder } from './recovery-ladder.js';
import { SafetyPolicyEngine } from './safety-policy-engine.js';
import { SafetyReasons, SafetySignals } from './signals.js';
import type {
    RecoveryStep,
    SafetyDecision,
    SafetyEvaluator,
    SafetySignal,
    SafetySnapshot,
} from './types.js';

const RECOVERY_ACTION_KINDS: ReadonlySet<ActionRequest['kind']> = new Set([
    'move-to',
    'follow-path',
    'use-block',
    'look-at',
    'attack',
    'equip',
    'consume',
    'wait',
    'collect-drops',
]);

export class ActionVetoGate {
    private readonly evaluators: readonly SafetyEvaluator[];
    private readonly claimLoss: ClaimLossEvaluator;
    private readonly recovery: RecoveryLadder;

    constructor(
        private readonly policy: SafetyPolicyEngine,
        private readonly emergencyStop: EmergencyStopController,
        claimLossOrEvaluators:
            ClaimLossEvaluator | readonly SafetyEvaluator[] = new ClaimLossEvaluator(),
        recovery = new RecoveryLadder(),
        evaluators: readonly SafetyEvaluator[] = [],
    ) {
        const suppliedEvaluators = ActionVetoGate.isEvaluatorList(claimLossOrEvaluators);
        this.evaluators = suppliedEvaluators ? claimLossOrEvaluators : evaluators;
        this.claimLoss = suppliedEvaluators ? new ClaimLossEvaluator() : claimLossOrEvaluators;
        this.recovery = recovery;
    }

    private static isEvaluatorList(
        value: ClaimLossEvaluator | readonly SafetyEvaluator[],
    ): value is readonly SafetyEvaluator[] {
        return Array.isArray(value);
    }

    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyDecision {
        const signals = this.snapshotSignals(snapshot);
        if (this.emergencyStop.stopped) {
            return {
                allowed: false,
                reason: this.emergencyStop.stopReason ?? SafetyReasons.emergencyStopActive,
                signals,
                recovery: {
                    kind: 'emergency-stop',
                    reason: this.emergencyStop.stopReason ?? SafetyReasons.emergencyStopActive,
                },
            };
        }
        if (signals.length === 0) this.recovery.reset();
        const blocking = this.blockingSignal(signals, request);
        const recovery = this.recoveryStep(signals);
        if (blocking) {
            return {
                allowed: false,
                reason: blocking.message,
                signals,
                recovery,
            };
        }
        if (this.recovery.safeModeActive && !this.isRecoveryAction(request)) {
            return {
                allowed: false,
                reason: this.recovery.currentSafeModeReason ?? SafetyReasons.safeModeActive,
                signals,
                recovery: {
                    kind: 'safe-mode',
                    reason: this.recovery.currentSafeModeReason ?? SafetyReasons.safeModeActive,
                },
            };
        }
        const ruleResult = this.policy.evaluate(snapshot, request);
        if (ruleResult) {
            if (ruleResult.recovery.kind === 'safe-mode') {
                this.recovery.enterSafeMode(ruleResult.recovery.reason);
            }
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
        for (const evaluator of this.evaluators) signals.push(...evaluator.evaluate(snapshot));
        if (this.emergencyStop.stopped) {
            signals.push(SafetySignals.emergencyStop(this.emergencyStop.stopReason));
        }
        return this.deduplicate(signals);
    }

    private blockingSignal(
        signals: readonly SafetySignal[],
        request: ActionRequest,
    ): SafetySignal | null {
        if (this.isRecoveryAction(request)) return null;
        return signals.find((signal) => signal.severity === 'critical') ?? null;
    }

    private recoveryStep(signals: readonly SafetySignal[]): RecoveryStep {
        if (signals.length > 0) return this.recovery.next(signals);
        if (this.recovery.safeModeActive) {
            return {
                kind: 'safe-mode',
                reason: this.recovery.currentSafeModeReason ?? SafetyReasons.safeModeActive,
            };
        }
        return { kind: 'retry-local', reason: SafetyReasons.noSafetySignal };
    }

    private isRecoveryAction(request: ActionRequest): boolean {
        return RECOVERY_ACTION_KINDS.has(request.kind);
    }

    private deduplicate(signals: readonly SafetySignal[]): readonly SafetySignal[] {
        const seen = new Set<string>();
        return signals.filter((signal) => {
            const key = `${signal.code}|${signal.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
}

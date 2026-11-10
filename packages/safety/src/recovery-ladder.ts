import type { RecoveryStep, SafetySignal } from './types.js';

export class RecoveryLadder {
    next(signals: readonly SafetySignal[]): RecoveryStep {
        const critical = signals.find((signal) => signal.severity === 'critical');
        if (critical) return this.criticalStep(signals, critical);
        const claimLost = signals.find((signal) => signal.code === 'claim.lost');
        if (claimLost) return { kind: 'safe-mode', reason: claimLost.message };
        const plannerSignal = signals.find(
            (signal) => signal.code === 'movement.stuck' || signal.code === 'movement.unreachable',
        );
        if (plannerSignal) return { kind: 'planner-replan', reason: plannerSignal.message };
        const warning = signals.find((signal) => signal.severity === 'warning');
        if (warning) return { kind: 'deterministic-alternative', reason: warning.message };
        return { kind: 'retry-local', reason: 'no safety signal' };
    }

    private criticalStep(signals: readonly SafetySignal[], critical: SafetySignal): RecoveryStep {
        const voidHazard = signals.find((signal) => signal.code === 'hazard.void');
        if (voidHazard) return { kind: 'emergency-stop', reason: voidHazard.message };
        if (critical.code === 'mob.threat' || critical.code === 'hunger.low') {
            return { kind: 'deterministic-alternative', reason: critical.message };
        }
        return { kind: 'safe-mode', reason: critical.message };
    }
}

import { SafetyReasons } from './signals.js';
import type { RecoveryStep, RecoveryStepKind, SafetySignal } from './types.js';

const ESCALATION_STEPS: readonly RecoveryStepKind[] = [
    'retry-local',
    'deterministic-alternative',
    'planner-replan',
    'safe-mode',
    'emergency-stop',
];

const EMERGENCY_STOP_LEVEL = 4;
const SAFE_MODE_LEVEL = 3;
const ESCALATION_DELAY_MILLISECONDS = 5_000;

export class RecoveryLadder {
    private level = 0;
    private safeModeReason: string | null = null;
    private lastEscalationAt = 0;
    private active = false;

    next(signals: readonly SafetySignal[], now = Date.now()): RecoveryStep {
        if (signals.length === 0) {
            this.reset();
            return { kind: 'retry-local', reason: SafetyReasons.noSafetySignal };
        }
        const requiredLevel = this.requiredLevel(signals);
        if (!this.active) {
            this.active = true;
            this.level = requiredLevel;
            this.lastEscalationAt = now;
        } else if (requiredLevel > this.level) {
            this.level = requiredLevel;
            this.lastEscalationAt = now;
        } else if (
            this.level < EMERGENCY_STOP_LEVEL &&
            now - this.lastEscalationAt >= ESCALATION_DELAY_MILLISECONDS
        ) {
            this.level += 1;
            this.lastEscalationAt = now;
        }
        if (this.level >= SAFE_MODE_LEVEL) this.safeModeReason = this.reasonFor(signals);
        return {
            kind: ESCALATION_STEPS[this.level] ?? 'emergency-stop',
            reason: this.reasonFor(signals),
        };
    }

    reset(): void {
        this.level = 0;
        this.safeModeReason = null;
        this.lastEscalationAt = 0;
        this.active = false;
    }

    enterSafeMode(reason: string): void {
        this.active = true;
        this.level = Math.max(this.level, SAFE_MODE_LEVEL);
        this.safeModeReason = reason;
        this.lastEscalationAt = Date.now();
    }

    get safeModeActive(): boolean {
        return this.safeModeReason !== null;
    }

    get currentSafeModeReason(): string | null {
        return this.safeModeReason;
    }

    private requiredLevel(signals: readonly SafetySignal[]): number {
        if (signals.some((signal) => signal.code === 'hazard.void')) return EMERGENCY_STOP_LEVEL;
        if (signals.some((signal) => signal.code === 'claim.lost')) return SAFE_MODE_LEVEL;
        const plannerSignal = signals.find(
            (signal) => signal.code === 'movement.stuck' || signal.code === 'movement.unreachable',
        );
        if (plannerSignal) return 2;
        const critical = signals.find((signal) => signal.severity === 'critical');
        if (!critical) return 0;
        if (critical.code === 'mob.threat' || critical.code === 'hunger.low') return 1;
        return SAFE_MODE_LEVEL;
    }

    private reasonFor(signals: readonly SafetySignal[]): string {
        const critical = signals.find((signal) => signal.severity === 'critical');
        if (critical) return critical.message;
        const warning = signals.find((signal) => signal.severity === 'warning');
        return warning?.message ?? signals[0]?.message ?? 'safety signal';
    }
}

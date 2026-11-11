import { SafetySignals } from './signals.js';
import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class ClaimLossEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (!snapshot.claimTrackingEnabled || snapshot.activeSkillId === null) return [];
        const claim = snapshot.world.claimFor(snapshot.botId);
        if (claim === null || typeof claim.expiresAt !== 'string') {
            return [SafetySignals.claimMissing()];
        }
        const expiresAt = Date.parse(claim.expiresAt);
        if (!Number.isFinite(expiresAt)) {
            return [SafetySignals.claimInvalidExpiry()];
        }
        const evaluatedAt = Date.parse(snapshot.at);
        if (!Number.isFinite(evaluatedAt)) {
            return [SafetySignals.claimEvaluationTimeInvalid()];
        }
        if (expiresAt <= evaluatedAt) {
            return [SafetySignals.claimExpired()];
        }
        return [];
    }
}

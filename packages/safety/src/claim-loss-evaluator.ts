import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class ClaimLossEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (!snapshot.claimTrackingEnabled || snapshot.activeSkillId === null) return [];
        const claim = snapshot.world.claimFor(snapshot.botId);
        if (claim === null || typeof claim.expiresAt !== 'string') {
            return [{ code: 'claim.lost', severity: 'critical', message: 'active claim missing' }];
        }
        const expiresAt = Date.parse(claim.expiresAt);
        if (!Number.isFinite(expiresAt)) {
            return [
                {
                    code: 'claim.lost',
                    severity: 'critical',
                    message: 'active claim has invalid expiry',
                },
            ];
        }
        const evaluatedAt = Date.parse(snapshot.at);
        if (!Number.isFinite(evaluatedAt)) {
            return [
                {
                    code: 'claim.lost',
                    severity: 'critical',
                    message: 'claim evaluation time is invalid',
                },
            ];
        }
        if (expiresAt <= evaluatedAt) {
            return [{ code: 'claim.lost', severity: 'critical', message: 'active claim expired' }];
        }
        return [];
    }
}

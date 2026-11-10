import type { SafetyEvaluator, SafetySignal, SafetySnapshot } from './types.js';

export class ClaimLossEvaluator implements SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[] {
        if (!snapshot.claimTrackingEnabled || snapshot.activeSkillId === null) return [];
        const claim = snapshot.world.claimFor(snapshot.botId);
        if (claim === null) {
            return [{ code: 'claim.lost', severity: 'critical', message: 'active claim missing' }];
        }
        if (Date.parse(claim.expiresAt) <= Date.parse(snapshot.at)) {
            return [{ code: 'claim.lost', severity: 'critical', message: 'active claim expired' }];
        }
        return [];
    }
}

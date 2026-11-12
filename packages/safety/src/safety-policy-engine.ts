import type { ActionRequest } from '@ticrafter/core';

import {
    ActiveBotSupportRule,
    ClaimBoundaryRule,
    MaterialBanRule,
    ProtectedBboxRule,
    type SafetyRule,
    type SafetyRuleResult,
} from './rules.js';
import type { SafetySnapshot } from './types.js';

export class SafetyPolicyEngine {
    constructor(
        private readonly rules: readonly SafetyRule[] = [
            new MaterialBanRule(),
            new ProtectedBboxRule(),
            new ClaimBoundaryRule(),
            new ActiveBotSupportRule(),
        ],
    ) {}

    evaluate(snapshot: SafetySnapshot, request: ActionRequest): SafetyRuleResult | null {
        for (const rule of this.rules) {
            const result = rule.evaluate(snapshot, request);
            if (result !== null) return result;
        }
        return null;
    }
}

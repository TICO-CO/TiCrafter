import type { Result } from '@ticrafter/core';

import type { BotBehaviorProfile, BotFailure, BotProfile, BotProfileStorePort } from './types.js';

export class BotBehaviorProfileManager {
    constructor(private readonly store: BotProfileStorePort) {}

    update(
        botId: string,
        behavior: Partial<BotBehaviorProfile>,
        now = new Date().toISOString(),
    ): Result<BotProfile, BotFailure> {
        const [profile, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        const merged = { ...profile.behavior, ...behavior };
        if (!this.isValid(merged)) {
            return [null, { type: 'INVALID_PROFILE', message: 'invalid behavior profile' }];
        }
        const updated: BotProfile = { ...profile, behavior: merged, updatedAt: now };
        const [, saveError] = this.store.save(updated);
        if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
        return [updated, null];
    }

    private isValid(behavior: BotBehaviorProfile): boolean {
        return (
            Number.isFinite(behavior.riskTolerance) &&
            behavior.riskTolerance >= 0 &&
            behavior.riskTolerance <= 1 &&
            Number.isFinite(behavior.workRadius) &&
            behavior.workRadius >= 0 &&
            Number.isFinite(behavior.sociability) &&
            behavior.sociability >= 0 &&
            behavior.sociability <= 1
        );
    }
}

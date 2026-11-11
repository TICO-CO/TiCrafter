import type { Result } from '@ticrafter/core';

import type { BotFailure, BotProfile, BotProfileStorePort, BotRole } from './types.js';

export class BotRoleManager {
    constructor(private readonly store: BotProfileStorePort) {}

    assignFixed(
        botId: string,
        role: BotRole,
        now = new Date().toISOString(),
    ): Result<BotProfile, BotFailure> {
        return this.update(botId, now, (profile) => ({
            ...profile,
            role,
            temporaryRole: null,
        }));
    }

    reassignTemporarily(
        botId: string,
        role: BotRole,
        now = new Date().toISOString(),
    ): Result<BotProfile, BotFailure> {
        return this.update(botId, now, (profile) => ({ ...profile, temporaryRole: role }));
    }

    restore(botId: string, now = new Date().toISOString()): Result<BotProfile, BotFailure> {
        return this.update(botId, now, (profile) => ({ ...profile, temporaryRole: null }));
    }

    activeRole(profile: BotProfile): BotRole {
        return profile.temporaryRole ?? profile.role;
    }

    private update(
        botId: string,
        now: string,
        change: (profile: BotProfile) => BotProfile,
    ): Result<BotProfile, BotFailure> {
        const [profile, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        const updated = { ...change(profile), updatedAt: now };
        const [, saveError] = this.store.save(updated);
        if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
        return [updated, null];
    }
}

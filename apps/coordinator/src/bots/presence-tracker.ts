import type { Result } from '@ticrafter/core';

import type { BotFailure, BotPresenceStatus, BotProfile, BotProfileStorePort } from './types.js';

export class BotPresenceTracker {
    constructor(private readonly store: BotProfileStorePort) {}

    markOnline(botId: string, now = new Date().toISOString()): Result<BotProfile, BotFailure> {
        return this.mark(botId, 'online', now);
    }

    markOffline(botId: string, now = new Date().toISOString()): Result<BotProfile, BotFailure> {
        return this.mark(botId, 'offline', now);
    }

    suspend(botId: string, now = new Date().toISOString()): Result<BotProfile, BotFailure> {
        return this.mark(botId, 'suspended', now);
    }

    isOnline(botId: string): boolean {
        const [profile, readError] = this.store.get(botId);
        if (readError || profile === null) return false;
        return profile.status === 'online';
    }

    list(): Result<readonly BotProfile[], BotFailure> {
        const [profiles, listError] = this.store.list();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        return [profiles, null];
    }

    private mark(
        botId: string,
        status: BotPresenceStatus,
        now: string,
    ): Result<BotProfile, BotFailure> {
        const [profile, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        const updated: BotProfile = { ...profile, status, lastSeen: now, updatedAt: now };
        const [, saveError] = this.store.save(updated);
        if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
        return [updated, null];
    }
}

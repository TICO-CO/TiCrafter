import type { Result } from '@ticrafter/core';

import { BotNamePoolAllocator } from './name-pool-allocator.js';
import type { BotProfileStorePort } from './types.js';
import type { BotFailure, BotProfile } from './types.js';

export class BotIdentityAuthenticator {
    constructor(
        private readonly store: BotProfileStorePort,
        private readonly names: readonly string[],
        private readonly allocator = new BotNamePoolAllocator(),
    ) {}

    authenticate(
        botId: string,
        username: string,
        now = new Date().toISOString(),
    ): Result<BotProfile, BotFailure> {
        const [existing, readError] = this.store.getByName(username);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (existing !== null) return this.verify(existing, botId);
        const botIndex = this.names.indexOf(username);
        if (botIndex < 0) {
            return [null, { type: 'NAME_POOL', message: `unknown bot name: ${username}` }];
        }
        const [profile, allocateError] = this.allocator.allocate(this.names, botIndex, now);
        if (allocateError) return [null, allocateError];
        if (profile === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'allocated profile missing' }];
        }
        const [, saveError] = this.store.save(profile);
        if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
        return this.verify(profile, botId);
    }

    private verify(profile: BotProfile, botId: string): Result<BotProfile, BotFailure> {
        if (profile.botId !== botId) {
            return [null, { type: 'IDENTITY_MISMATCH', botId, username: profile.username }];
        }
        return [profile, null];
    }
}

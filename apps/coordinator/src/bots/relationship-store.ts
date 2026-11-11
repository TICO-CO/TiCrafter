import type { Result } from '@ticrafter/core';

import type { BotFailure, BotProfile, BotProfileStorePort, BotRelationship } from './types.js';

export class BotRelationshipStore {
    constructor(private readonly store: BotProfileStorePort) {}

    record(
        botId: string,
        otherBotId: string,
        trustDelta: number,
        now = new Date().toISOString(),
    ): Result<BotProfile, BotFailure> {
        if (botId === otherBotId) {
            return [null, { type: 'INVALID_PROFILE', message: 'cannot relate a bot to itself' }];
        }
        const [profile, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        const relationships = this.upsert(profile.relationships, otherBotId, trustDelta);
        const updated: BotProfile = { ...profile, relationships, updatedAt: now };
        const [, saveError] = this.store.save(updated);
        if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
        return [updated, null];
    }

    list(botId: string): Result<readonly BotRelationship[], BotFailure> {
        const [profile, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        return [profile.relationships, null];
    }

    private upsert(
        relationships: readonly BotRelationship[],
        otherBotId: string,
        trustDelta: number,
    ): readonly BotRelationship[] {
        const existing = relationships.find((relationship) => relationship.botId === otherBotId);
        if (existing === undefined) {
            return [
                ...relationships,
                { botId: otherBotId, trust: this.clamp(trustDelta), interactions: 1 },
            ];
        }
        return relationships.map((relationship) => {
            if (relationship.botId !== otherBotId) return relationship;
            return {
                ...relationship,
                trust: this.clamp(relationship.trust + trustDelta),
                interactions: relationship.interactions + 1,
            };
        });
    }

    private clamp(value: number): number {
        return Math.min(1, Math.max(0, value));
    }
}

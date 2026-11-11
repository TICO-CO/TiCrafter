import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { EditGrantRecord } from '../grants/index.js';
import type { TaskRecord } from '../tasks/index.js';
import type { BotFailure, BotProfile, BotProfileStorePort } from './types.js';

export interface BotDeltaSyncPorts {
    tasks: { list(): Result<readonly TaskRecord[], StorageFailure> };
    grants: { listActive(): Result<readonly EditGrantRecord[], StorageFailure> };
    sip: { revision(): Result<number, StorageFailure> };
}

export interface BotStateDelta {
    sipRevision: number;
    tasks: readonly TaskRecord[];
    grants: readonly EditGrantRecord[];
}

export class BotDeltaSyncPlanner {
    constructor(
        private readonly store: BotProfileStorePort,
        private readonly ports: BotDeltaSyncPorts,
    ) {}

    plan(botId: string): Result<BotStateDelta, BotFailure> {
        const [profile, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        const [sipRevision, sipError] = this.ports.sip.revision();
        if (sipError) return [null, { type: 'STORAGE', failure: sipError }];
        if (sipRevision === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'sip revision missing' }];
        }
        const [tasks, taskError] = this.ports.tasks.list();
        if (taskError) return [null, { type: 'STORAGE', failure: taskError }];
        const [grants, grantError] = this.ports.grants.listActive();
        if (grantError) return [null, { type: 'STORAGE', failure: grantError }];
        if (tasks === null || grants === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'delta state missing' }];
        }
        return [
            {
                sipRevision,
                tasks: this.changedTasks(tasks, profile),
                grants: this.changedGrants(grants, profile),
            },
            null,
        ];
    }

    private changedTasks(tasks: readonly TaskRecord[], profile: BotProfile): readonly TaskRecord[] {
        const lastSeen = Date.parse(profile.lastSeen);
        return tasks.filter((task) => {
            const updatedAt = Date.parse(task.updatedAt);
            if (!Number.isFinite(lastSeen) || !Number.isFinite(updatedAt)) return true;
            return updatedAt > lastSeen || task.claimedBy === profile.botId;
        });
    }

    private changedGrants(
        grants: readonly EditGrantRecord[],
        profile: BotProfile,
    ): readonly EditGrantRecord[] {
        const lastSeen = Date.parse(profile.lastSeen);
        return grants.filter((grant) => {
            const updatedAt = Date.parse(grant.updatedAt);
            if (!Number.isFinite(lastSeen) || !Number.isFinite(updatedAt)) return true;
            return updatedAt > lastSeen || grant.granteeBotId === profile.botId;
        });
    }
}

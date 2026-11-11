import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { ClaimRecord } from '../claims/index.js';
import type { EditGrantRecord } from '../grants/index.js';
import type { TaskRecord } from '../tasks/index.js';
import type { BotDeltaSyncPlanner, BotStateDelta } from './delta-sync-planner.js';
import type { BotFailure, BotProfile, BotProfileStorePort } from './types.js';

export interface BotResumePorts {
    claims: { listActive(): Result<readonly ClaimRecord[], StorageFailure> };
    tasks: {
        get(taskId: string): Result<TaskRecord | null, StorageFailure>;
        list(): Result<readonly TaskRecord[], StorageFailure>;
    };
    grants: { listActive(): Result<readonly EditGrantRecord[], StorageFailure> };
    checkpoints: {
        load(botId: string, taskId: string, skillId: string): Result<unknown, StorageFailure>;
    };
}

export interface BotResumePlan {
    profile: BotProfile;
    task: TaskRecord | null;
    claims: readonly ClaimRecord[];
    grants: readonly EditGrantRecord[];
    checkpoint: unknown;
    delta: BotStateDelta;
}

export class BotResumeOrchestrator {
    constructor(
        private readonly store: BotProfileStorePort,
        private readonly ports: BotResumePorts,
        private readonly delta: BotDeltaSyncPlanner,
        private readonly epoch: number,
    ) {}

    resume(botId: string, now = new Date().toISOString()): Result<BotResumePlan, BotFailure> {
        const [stored, readError] = this.store.get(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (stored === null) return [null, { type: 'BOT_NOT_FOUND', botId }];
        const [task, taskError] = this.task(stored);
        if (taskError) return [null, taskError];
        const [claims, claimError] = this.claims(botId);
        if (claimError) return [null, claimError];
        if (claims === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'claims missing' }];
        }
        const [grants, grantError] = this.grants(botId);
        if (grantError) return [null, grantError];
        if (grants === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'grants missing' }];
        }
        const [profile, profileError] = this.reconcileProfile(stored, task, claims, now);
        if (profileError) return [null, profileError];
        if (profile === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'profile missing' }];
        }
        const [checkpoint, checkpointError] = this.checkpoint(profile);
        if (checkpointError) return [null, checkpointError];
        const [delta, deltaError] = this.delta.plan(botId);
        if (deltaError) return [null, deltaError];
        if (delta === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'delta missing' }];
        }
        return [
            {
                profile,
                task,
                claims,
                grants,
                checkpoint,
                delta,
            },
            null,
        ];
    }

    private task(profile: BotProfile): Result<TaskRecord | null, BotFailure> {
        if (profile.currentTaskId !== null) {
            const [task, readError] = this.ports.tasks.get(profile.currentTaskId);
            if (readError) return [null, { type: 'STORAGE', failure: readError }];
            return [task, null];
        }
        const [tasks, listError] = this.ports.tasks.list();
        if (listError) return [null, { type: 'STORAGE', failure: listError }];
        if (tasks === null) {
            return [null, { type: 'INVALID_PROFILE', message: 'task list missing' }];
        }
        const active = tasks
            .filter(
                (task) =>
                    task.claimedBy === profile.botId &&
                    (task.status === 'claimed' || task.status === 'running'),
            )
            .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
        return [active[0] ?? null, null];
    }

    private claims(botId: string): Result<readonly ClaimRecord[], BotFailure> {
        const [claims, readError] = this.ports.claims.listActive();
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (claims === null) return [null, { type: 'INVALID_PROFILE', message: 'claims missing' }];
        return [claims.filter((claim) => claim.botId === botId), null];
    }

    private grants(botId: string): Result<readonly EditGrantRecord[], BotFailure> {
        const [grants, readError] = this.ports.grants.listActive();
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (grants === null) return [null, { type: 'INVALID_PROFILE', message: 'grants missing' }];
        return [
            grants.filter(
                (grant) =>
                    grant.epoch === this.epoch &&
                    (grant.granteeBotId === botId || grant.ownerBotId === botId),
            ),
            null,
        ];
    }

    private reconcileProfile(
        profile: BotProfile,
        task: TaskRecord | null,
        claims: readonly ClaimRecord[],
        now: string,
    ): Result<BotProfile, BotFailure> {
        const staleTask =
            profile.currentTaskId !== null &&
            (task === null || this.isTerminal(task) || this.isOwnedElsewhere(task, profile.botId));
        if (!staleTask) {
            const skill = task === null ? null : (profile.currentSkill ?? this.taskSkill(task));
            const updated = {
                ...profile,
                currentTaskId: task?.id ?? null,
                currentSkill: skill,
                activeClaimIds: claims.map((claim) => claim.id),
                lastSeen: now,
                updatedAt: now,
            };
            const [, saveError] = this.store.save(updated);
            if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
            return [updated, null];
        }
        const updated: BotProfile = {
            ...profile,
            currentTaskId: null,
            currentSkill: null,
            currentStructureId: null,
            activeClaimIds: claims.map((claim) => claim.id),
            lastSeen: now,
            updatedAt: now,
        };
        const [, saveError] = this.store.save(updated);
        if (saveError) return [null, { type: 'STORAGE', failure: saveError }];
        return [updated, null];
    }

    private checkpoint(profile: BotProfile): Result<unknown, BotFailure> {
        if (profile.currentTaskId === null || profile.currentSkill === null) return [null, null];
        const [checkpoint, readError] = this.ports.checkpoints.load(
            profile.botId,
            profile.currentTaskId,
            profile.currentSkill,
        );
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        return [checkpoint, null];
    }

    private taskSkill(task: TaskRecord): string | null {
        const skillId = task.payload.skillId;
        return typeof skillId === 'string' && skillId.length > 0 ? skillId : null;
    }

    private isTerminal(task: TaskRecord): boolean {
        return (
            task.status === 'completed' ||
            task.status === 'failed' ||
            task.status === 'dead_letter' ||
            task.status === 'cancelled'
        );
    }

    private isOwnedElsewhere(task: TaskRecord, botId: string): boolean {
        return (task.status === 'claimed' || task.status === 'running') && task.claimedBy !== botId;
    }
}

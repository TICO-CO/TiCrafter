import { afterEach, describe, expect, it } from 'bun:test';

import type { ClaimRecord } from '../claims/index.js';
import type { CoordinatorDatabase } from '../core/index.js';
import type { EditGrantRecord } from '../grants/index.js';
import type { TaskRecord } from '../tasks/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { BotBehaviorProfileManager } from './behavior-profile-manager.js';
import { BotDeltaSyncPlanner } from './delta-sync-planner.js';
import { BotIdentityAuthenticator } from './identity-authenticator.js';
import { BotNamePoolAllocator } from './name-pool-allocator.js';
import { BotPresenceTracker } from './presence-tracker.js';
import { BotProfileStore } from './profile-store.js';
import { BotRelationshipStore } from './relationship-store.js';
import { BotResumeOrchestrator } from './resume-orchestrator.js';
import { BotRoleManager } from './role-manager.js';
import type { BotProfile } from './types.js';

const now = '2026-11-11T10:00:00.000Z';
const names = ['TiBot1', 'TiBot2'];

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord =>
    ({
        id: 'task-1',
        status: 'claimed',
        claimedBy: 'bot.tibot1',
        updatedAt: now,
        ...overrides,
    }) as TaskRecord;

const grant = (overrides: Partial<EditGrantRecord> = {}): EditGrantRecord =>
    ({
        id: 'grant-1',
        structureId: 'structure.house',
        ownerBotId: 'bot.tibot1',
        granteeBotId: 'bot.tibot1',
        status: 'active',
        updatedAt: now,
        epoch: 7,
        ...overrides,
    }) as EditGrantRecord;

const claim = (overrides: Partial<ClaimRecord> = {}): ClaimRecord =>
    ({
        id: 'claim-1',
        botId: 'bot.tibot1',
        status: 'active',
        ...overrides,
    }) as ClaimRecord;

describe('bots', () => {
    const fresh = (): { store: BotProfileStore; profile: BotProfile } => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const store = new BotProfileStore(database as CoordinatorDatabase);
        const [profile, allocateError] = new BotNamePoolAllocator().allocate(names, 0, now);
        expect(allocateError).toBeNull();
        expect(profile).not.toBeNull();
        const value = profile as BotProfile;
        const [, saveError] = store.save(value);
        expect(saveError).toBeNull();
        return { store, profile: value };
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('allocates stable identity from the name pool', () => {
        const allocator = new BotNamePoolAllocator();
        const [profile, allocateError] = allocator.allocate(names, 0, now);
        expect(allocateError).toBeNull();
        expect(profile?.botId).toBe('bot.tibot1');
        expect(profile?.username).toBe('TiBot1');
        expect(profile?.botIndex).toBe(0);
        const [, invalidError] = allocator.allocate(names, 5, now);
        expect(invalidError?.type).toBe('NAME_POOL');
    });

    it('authenticates and registers known bots', () => {
        const { store } = fresh();
        const authenticator = new BotIdentityAuthenticator(store, names);
        const [profile, authError] = authenticator.authenticate('bot.tibot2', 'TiBot2', now);
        expect(authError).toBeNull();
        expect(profile?.botId).toBe('bot.tibot2');
        const [, mismatchError] = authenticator.authenticate('bot.other', 'TiBot2', now);
        expect(mismatchError?.type).toBe('IDENTITY_MISMATCH');
    });

    it('persists roles, behavior, relationships, and presence', () => {
        const { store, profile } = fresh();
        const roles = new BotRoleManager(store);
        const [temporary, temporaryError] = roles.reassignTemporarily(profile.botId, 'farmer', now);
        expect(temporaryError).toBeNull();
        expect(temporary?.temporaryRole).toBe('farmer');
        const [restored, restoreError] = roles.restore(profile.botId, now);
        expect(restoreError).toBeNull();
        expect(restored?.temporaryRole).toBeNull();
        expect(roles.activeRole(restored as BotProfile)).toBe('builder');

        const behavior = new BotBehaviorProfileManager(store);
        const [updated, behaviorError] = behavior.update(profile.botId, { workRadius: 96 }, now);
        expect(behaviorError).toBeNull();
        expect(updated?.behavior.workRadius).toBe(96);
        const [, invalidError] = behavior.update(profile.botId, { riskTolerance: 2 }, now);
        expect(invalidError?.type).toBe('INVALID_PROFILE');

        const relationships = new BotRelationshipStore(store);
        const [related, relationError] = relationships.record(
            profile.botId,
            'bot.tibot2',
            0.3,
            now,
        );
        expect(relationError).toBeNull();
        expect(related?.relationships[0]?.trust).toBe(0.3);

        const presence = new BotPresenceTracker(store);
        const [online] = presence.markOnline(profile.botId, now);
        expect(online?.status).toBe('online');
        expect(presence.isOnline(profile.botId)).toBe(true);
        presence.markOffline(profile.botId, now);
        expect(presence.isOnline(profile.botId)).toBe(false);
    });

    it('plans deltas and resumes stale task state', () => {
        const { store, profile } = fresh();
        const claimed = {
            ...profile,
            currentTaskId: 'task-1',
            currentSkill: 'build',
            lastSeen: '2026-11-11T09:59:00.000Z',
        };
        store.save(claimed);
        const delta = new BotDeltaSyncPlanner(store, {
            tasks: { list: () => [[task()], null] },
            grants: { listActive: () => [[grant()], null] },
            sip: { revision: () => [4, null] },
        });
        const resume = new BotResumeOrchestrator(
            store,
            {
                claims: { listActive: () => [[claim()], null] },
                tasks: {
                    get: () => [task({ status: 'completed' }), null],
                    list: () => [[task({ status: 'completed' })], null],
                },
                grants: { listActive: () => [[grant()], null] },
                checkpoints: { load: () => [{ step: 2 }, null] },
            },
            delta,
            7,
        );
        const [plan, resumeError] = resume.resume(profile.botId, now);
        expect(resumeError).toBeNull();
        expect(plan?.claims).toHaveLength(1);
        expect(plan?.grants).toHaveLength(1);
        expect(plan?.profile.currentTaskId).toBeNull();
        expect(plan?.delta.sipRevision).toBe(4);
        expect(plan?.delta.tasks).toHaveLength(1);
    });

    it('discovers a task already claimed by the reconnecting bot', () => {
        const { store, profile } = fresh();
        const active = task({ payload: { skillId: 'navigate' } });
        const delta = new BotDeltaSyncPlanner(store, {
            tasks: { list: () => [[active], null] },
            grants: { listActive: () => [[], null] },
            sip: { revision: () => [4, null] },
        });
        const requested: string[] = [];
        const resume = new BotResumeOrchestrator(
            store,
            {
                claims: { listActive: () => [[], null] },
                tasks: { get: () => [null, null], list: () => [[active], null] },
                grants: { listActive: () => [[], null] },
                checkpoints: {
                    load: (botId, taskId, skillId) => {
                        requested.push(`${botId}|${taskId}|${skillId}`);
                        return [{ step: 3 }, null];
                    },
                },
            },
            delta,
            7,
        );
        const [plan, resumeError] = resume.resume(profile.botId, now);

        expect(resumeError).toBeNull();
        expect(plan?.task?.id).toBe('task-1');
        expect(plan?.profile.currentTaskId).toBe('task-1');
        expect(plan?.profile.currentSkill).toBe('navigate');
        expect(plan?.checkpoint).toEqual({ step: 3 });
        expect(requested).toEqual(['bot.tibot1|task-1|navigate']);
    });
});

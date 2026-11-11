import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

export type BotRole = 'builder' | 'farmer' | 'miner' | 'scout' | 'hauler' | 'guard';

export type BotPresenceStatus = 'online' | 'offline' | 'suspended';

export interface BotBehaviorProfile {
    riskTolerance: number;
    workRadius: number;
    sociability: number;
    preferredBaseId: string | null;
}

export interface BotRelationship {
    botId: string;
    trust: number;
    interactions: number;
}

export interface BotSyncCursors {
    lastWorldVersion: number;
    lastSipRevision: number;
    lastTaskRevision: number;
    lastGrantRevision: number;
}

export interface BotProfile {
    botId: string;
    username: string;
    uuid: string;
    botIndex: number;
    role: BotRole;
    temporaryRole: BotRole | null;
    behavior: BotBehaviorProfile;
    status: BotPresenceStatus;
    currentTaskId: string | null;
    currentSkill: string | null;
    currentStructureId: string | null;
    activeClaimIds: readonly string[];
    homeStructureId: string | null;
    relationships: readonly BotRelationship[];
    editGrantIds: readonly string[];
    cursors: BotSyncCursors;
    createdAt: string;
    lastSeen: string;
    updatedAt: string;
}

export interface BotProfileStorePort {
    get(botId: string): Result<BotProfile | null, StorageFailure>;
    getByName(username: string): Result<BotProfile | null, StorageFailure>;
    save(profile: BotProfile): Result<void, StorageFailure>;
}

export interface BotSessionPort {
    isOnline(botId: string): boolean;
}

export type BotFailure =
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'INVALID_PROFILE'; message: string }
    | { type: 'BOT_NOT_FOUND'; botId: string }
    | { type: 'DUPLICATE_BOT'; botId: string }
    | { type: 'NAME_POOL'; message: string }
    | { type: 'IDENTITY_MISMATCH'; botId: string; username: string };

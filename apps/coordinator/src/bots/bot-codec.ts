import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';
import { z as zod } from 'zod';

import type { BotProfile } from './types.js';

export interface BotProfileRow {
    id: string;
    name: string;
    role: string | null;
    profile_json: string;
    created_at: string;
    updated_at: string;
    status: string;
    last_seen: string;
    bot_index: number;
}

const roleSchema = zod.enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard']);
const statusSchema = zod.enum(['online', 'offline', 'suspended']);

const behaviorSchema = zod.object({
    riskTolerance: zod.number(),
    workRadius: zod.number(),
    sociability: zod.number(),
    preferredBaseId: zod.string().nullable(),
});

const relationshipSchema = zod.object({
    botId: zod.string().min(1),
    trust: zod.number(),
    interactions: zod.number().int().nonnegative(),
});

const cursorSchema = zod.object({
    lastWorldVersion: zod.number().int().nonnegative(),
    lastSipRevision: zod.number().int().nonnegative(),
    lastTaskRevision: zod.number().int().nonnegative(),
    lastGrantRevision: zod.number().int().nonnegative(),
});

const profileSchema = zod.object({
    botId: zod.string().min(1),
    username: zod.string().min(1),
    uuid: zod.string(),
    botIndex: zod.number().int().nonnegative(),
    role: roleSchema,
    temporaryRole: roleSchema.nullable(),
    behavior: behaviorSchema,
    status: statusSchema,
    currentTaskId: zod.string().nullable(),
    currentSkill: zod.string().nullable(),
    currentStructureId: zod.string().nullable(),
    activeClaimIds: zod.array(zod.string().min(1)),
    homeStructureId: zod.string().nullable(),
    relationships: zod.array(relationshipSchema),
    editGrantIds: zod.array(zod.string().min(1)),
    cursors: cursorSchema,
    createdAt: zod.string().min(1),
    lastSeen: zod.string(),
    updatedAt: zod.string().min(1),
});

export class BotProfileCodec {
    static decode(row: BotProfileRow): Result<BotProfile, StorageFailure> {
        const [raw, parseError] = attempt<unknown, unknown>(() => JSON.parse(row.profile_json));
        if (parseError) return [null, StorageFailures.from('READ_FAILED', parseError)];
        const parsed = profileSchema.safeParse(raw);
        if (!parsed.success) {
            return [
                null,
                StorageFailures.from(
                    'READ_FAILED',
                    parsed.error.issues.map((issue) => issue.message).join('; '),
                ),
            ];
        }
        if (parsed.data.botId !== row.id || parsed.data.username !== row.name) {
            return [null, StorageFailures.from('READ_FAILED', 'profile identity mismatch')];
        }
        const status = statusSchema.safeParse(row.status);
        if (!status.success) {
            return [null, StorageFailures.from('READ_FAILED', `invalid bot status: ${row.status}`)];
        }
        return [
            {
                ...parsed.data,
                username: row.name,
                status: status.data,
                lastSeen: row.last_seen,
                updatedAt: row.updated_at,
                botIndex: row.bot_index,
            },
            null,
        ];
    }

    static encode(profile: BotProfile): string {
        return JSON.stringify(profile);
    }
}

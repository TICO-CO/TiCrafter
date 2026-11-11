import { NamePoolValidator, type Result } from '@ticrafter/core';

import type { BotFailure, BotProfile } from './types.js';

export class BotNamePoolAllocator {
    allocate(
        names: readonly string[],
        botIndex: number,
        now = new Date().toISOString(),
    ): Result<BotProfile, BotFailure> {
        if (!Number.isInteger(botIndex) || botIndex < 0) {
            return [null, { type: 'NAME_POOL', message: `invalid bot index ${botIndex}` }];
        }
        const [name, nameError] = NamePoolValidator.nameFor([...names], botIndex);
        if (nameError) {
            return [
                null,
                {
                    type: 'NAME_POOL',
                    message: 'message' in nameError ? nameError.message : nameError.type,
                },
            ];
        }
        if (name === null) return [null, { type: 'NAME_POOL', message: 'name missing' }];
        const botId = `bot.${name.toLowerCase()}`;
        return [
            {
                botId,
                username: name,
                uuid: botId,
                botIndex,
                role: 'builder',
                temporaryRole: null,
                behavior: {
                    riskTolerance: 0.5,
                    workRadius: 64,
                    sociability: 0.5,
                    preferredBaseId: null,
                },
                status: 'offline',
                currentTaskId: null,
                currentSkill: null,
                currentStructureId: null,
                activeClaimIds: [],
                homeStructureId: null,
                relationships: [],
                editGrantIds: [],
                cursors: {
                    lastWorldVersion: 0,
                    lastSipRevision: 0,
                    lastTaskRevision: 0,
                    lastGrantRevision: 0,
                },
                createdAt: now,
                lastSeen: now,
                updatedAt: now,
            },
            null,
        ];
    }
}

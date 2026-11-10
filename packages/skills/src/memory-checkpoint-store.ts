import type { Result } from '@ticrafter/core';

import type { SkillCheckpointRecord, SkillCheckpointStore } from './checkpoint-manager.js';

export class MemoryCheckpointStore implements SkillCheckpointStore {
    private readonly records = new Map<string, SkillCheckpointRecord>();

    save(record: SkillCheckpointRecord): Result<void, string> {
        this.records.set(`${record.botId}:${record.skillId}`, record);
        return [undefined, null];
    }

    load(botId: string, skillId: string): Result<SkillCheckpointRecord | null, string> {
        return [this.records.get(`${botId}:${skillId}`) ?? null, null];
    }

    delete(botId: string, skillId: string): Result<void, string> {
        this.records.delete(`${botId}:${skillId}`);
        return [undefined, null];
    }
}

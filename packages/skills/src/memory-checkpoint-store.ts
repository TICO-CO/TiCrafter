import type { Result } from '@ticrafter/core';

import type { SkillCheckpointRecord, SkillCheckpointStore } from './checkpoint-manager.js';

export class MemoryCheckpointStore implements SkillCheckpointStore {
    private readonly records = new Map<string, SkillCheckpointRecord>();

    save(record: SkillCheckpointRecord): Result<void, string> {
        this.records.set(record.id, record);
        return [undefined, null];
    }

    load(
        botId: string,
        taskId: string,
        skillId: string,
    ): Result<SkillCheckpointRecord | null, string> {
        return [this.records.get(MemoryCheckpointStore.key(botId, taskId, skillId)) ?? null, null];
    }

    delete(botId: string, taskId: string, skillId: string): Result<void, string> {
        this.records.delete(MemoryCheckpointStore.key(botId, taskId, skillId));
        return [undefined, null];
    }

    private static key(botId: string, taskId: string, skillId: string): string {
        return `${botId}:${taskId}:${skillId}`;
    }
}

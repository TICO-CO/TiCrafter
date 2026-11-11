import type { Result } from '@ticrafter/core';
import {
    type SkillCheckpointRecord as MemorySkillCheckpointRecord,
    type SqliteSkillCheckpointStore,
} from '@ticrafter/memory';
import type { SkillCheckpointRecord, SkillCheckpointStore } from '@ticrafter/skills';

export class SqliteCheckpointStore implements SkillCheckpointStore {
    constructor(private readonly store: SqliteSkillCheckpointStore) {}

    save(record: SkillCheckpointRecord): Result<void, string> {
        const [, saveError] = this.store.save(this.toMemoryRecord(record));
        if (saveError) return [null, saveError.message];
        return [undefined, null];
    }

    load(
        botId: string,
        taskId: string,
        skillId: string,
    ): Result<SkillCheckpointRecord | null, string> {
        const [record, loadError] = this.store.load(botId, taskId, skillId);
        if (loadError) return [null, loadError.message];
        if (record === null) return [null, null];
        return [record, null];
    }

    delete(botId: string, taskId: string, skillId: string): Result<void, string> {
        const [, deleteError] = this.store.delete(botId, taskId, skillId);
        if (deleteError) return [null, deleteError.message];
        return [undefined, null];
    }

    private toMemoryRecord(record: SkillCheckpointRecord): MemorySkillCheckpointRecord {
        return {
            id: record.id,
            botId: record.botId,
            taskId: record.taskId,
            skillId: record.skillId,
            stateJson: record.stateJson,
            updatedAt: record.updatedAt,
        };
    }
}

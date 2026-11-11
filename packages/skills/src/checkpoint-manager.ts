import { attempt, type Result } from '@ticrafter/core';

import type { SkillCheckpoint } from './types.js';

export interface SkillCheckpointRecord {
    id: string;
    botId: string;
    taskId: string;
    skillId: string;
    stateJson: string;
    updatedAt: string;
}

export interface SkillCheckpointStore {
    save(record: SkillCheckpointRecord): Result<void, string>;
    load(
        botId: string,
        taskId: string,
        skillId: string,
    ): Result<SkillCheckpointRecord | null, string>;
    delete(botId: string, taskId: string, skillId: string): Result<void, string>;
}

export class CheckpointManager {
    constructor(private readonly store: SkillCheckpointStore) {}

    save(checkpoint: SkillCheckpoint): Result<void, string> {
        const [stateJson, encodeError] = attempt(() => JSON.stringify(checkpoint.state));
        if (encodeError) return [null, 'checkpoint state is not serializable'];
        if (stateJson === null) return [null, 'checkpoint state returned null'];
        return this.store.save({
            id: CheckpointManager.key(checkpoint.botId, checkpoint.taskId, checkpoint.skillId),
            botId: checkpoint.botId,
            taskId: checkpoint.taskId,
            skillId: checkpoint.skillId,
            stateJson,
            updatedAt: checkpoint.updatedAt,
        });
    }

    load(botId: string, taskId: string, skillId: string): Result<SkillCheckpoint | null, string> {
        const [record, loadError] = this.store.load(botId, taskId, skillId);
        if (loadError) return [null, loadError];
        if (record === null) return [null, null];
        const [state, decodeError] = attempt<Record<string, unknown>>(() =>
            JSON.parse(record.stateJson),
        );
        if (decodeError || state === null) return [null, 'checkpoint state is invalid'];
        return [
            {
                botId: record.botId,
                taskId: record.taskId,
                skillId: record.skillId,
                state,
                updatedAt: record.updatedAt,
            },
            null,
        ];
    }

    delete(botId: string, taskId: string, skillId: string): Result<void, string> {
        return this.store.delete(botId, taskId, skillId);
    }

    private static key(botId: string, taskId: string, skillId: string): string {
        return `${botId}:${taskId}:${skillId}`;
    }
}

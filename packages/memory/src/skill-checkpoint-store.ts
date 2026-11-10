import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export interface SkillCheckpointRecord {
    id: string;
    botId: string;
    skillId: string;
    stateJson: string;
    updatedAt: string;
}

export class SqliteSkillCheckpointStore {
    constructor(private readonly database: Database) {}

    save(record: SkillCheckpointRecord): Result<void, StorageFailure> {
        const [, error] = attempt(() => {
            this.database
                .prepare(
                    `INSERT INTO skill_checkpoints (id, bot_id, skill_id, state_json, updated_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                         state_json = excluded.state_json,
                         updated_at = excluded.updated_at`,
                )
                .run(record.id, record.botId, record.skillId, record.stateJson, record.updatedAt);
        });
        if (error) return [null, StorageFailures.from('WRITE_FAILED', error)];
        return [undefined, null];
    }

    load(botId: string, skillId: string): Result<SkillCheckpointRecord | null, StorageFailure> {
        const [record, error] = attempt(
            () =>
                this.database
                    .prepare(
                        `SELECT id, bot_id AS botId, skill_id AS skillId,
                                state_json AS stateJson, updated_at AS updatedAt
                         FROM skill_checkpoints
                         WHERE bot_id = ? AND skill_id = ?`,
                    )
                    .get(botId, skillId) as SkillCheckpointRecord | undefined,
        );
        if (error) return [null, StorageFailures.from('READ_FAILED', error)];
        return [record ?? null, null];
    }

    delete(botId: string, skillId: string): Result<void, StorageFailure> {
        const [, error] = attempt(() => {
            this.database
                .prepare('DELETE FROM skill_checkpoints WHERE bot_id = ? AND skill_id = ?')
                .run(botId, skillId);
        });
        if (error) return [null, StorageFailures.from('WRITE_FAILED', error)];
        return [undefined, null];
    }
}

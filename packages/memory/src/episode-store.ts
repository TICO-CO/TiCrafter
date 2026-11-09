import type { Database } from 'bun:sqlite';
import { attempt, type Result } from '@ticrafter/core';
import { StorageFailures, type StorageFailure } from './failures.js';

export interface Episode {
    id: string;
    taskId?: string;
    botId?: string;
    outcome: string;
    payload?: unknown;
    createdAt?: string;
}

interface EpisodeRow {
    id: string;
    task_id: string | null;
    bot_id: string | null;
    outcome: string;
    payload_json: string;
    created_at: string;
}

export class EpisodeStore {
    constructor(private readonly db: Database) {}

    save(episode: Episode): Result<void, StorageFailure> {
        const [, error] = attempt(() => {
            this.db
                .prepare(
                    `INSERT OR REPLACE INTO episodes (id, task_id, bot_id, outcome, payload_json, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    episode.id,
                    episode.taskId ?? null,
                    episode.botId ?? null,
                    episode.outcome,
                    JSON.stringify(episode.payload ?? {}),
                    episode.createdAt ?? new Date().toISOString(),
                );
        });
        if (error) {
            return [null, StorageFailures.from('WRITE_FAILED', error)];
        }

        return [undefined, null];
    }

    list(limit = 100): Result<Episode[], StorageFailure> {
        const [episodes, error] = attempt(() => {
            const rows = this.db
                .prepare(
                    'SELECT id, task_id, bot_id, outcome, payload_json, created_at FROM episodes ORDER BY created_at DESC LIMIT ?',
                )
                .all(limit) as EpisodeRow[];
            return rows.map((row) => ({
                id: row.id,
                taskId: row.task_id ?? undefined,
                botId: row.bot_id ?? undefined,
                outcome: row.outcome,
                payload: JSON.parse(row.payload_json) as unknown,
                createdAt: row.created_at,
            }));
        });
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        if (episodes === null) {
            return [null, StorageFailures.from('READ_FAILED', 'Episodes missing')];
        }

        return [episodes, null];
    }
}

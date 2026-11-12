import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export interface AgentEpisode {
    id: string;
    botId: string;
    goalId: string | null;
    kind: string;
    summary: string;
    position: { x: number; y: number; z: number } | null;
    relatedBotId: string | null;
    payload: unknown;
    createdAt: string;
}

interface AgentEpisodeRow {
    id: string;
    bot_id: string;
    goal_id: string | null;
    kind: string;
    summary: string;
    position_json: string | null;
    related_bot_id: string | null;
    payload_json: string;
    created_at: string;
}

export class AgentEpisodeRepository {
    constructor(private readonly database: Database) {}

    append(episode: AgentEpisode): Result<void, StorageFailure> {
        const [, error] = attempt(() => {
            this.database
                .prepare(
                    `INSERT OR REPLACE INTO agent_episodes (
                        id, bot_id, goal_id, kind, summary, position_json,
                        related_bot_id, payload_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    episode.id,
                    episode.botId,
                    episode.goalId,
                    episode.kind,
                    episode.summary,
                    episode.position === null ? null : JSON.stringify(episode.position),
                    episode.relatedBotId,
                    JSON.stringify(episode.payload ?? {}),
                    episode.createdAt,
                );
        });
        if (error) return [null, StorageFailures.from('WRITE_FAILED', error)];
        return [undefined, null];
    }

    list(botId: string, limit = 100): Result<AgentEpisode[], StorageFailure> {
        const [episodes, error] = attempt(() => {
            const rows = this.database
                .prepare(
                    `SELECT id, bot_id, goal_id, kind, summary, position_json,
                            related_bot_id, payload_json, created_at
                     FROM agent_episodes
                     WHERE bot_id = ?
                     ORDER BY created_at DESC
                     LIMIT ?`,
                )
                .all(botId, limit) as AgentEpisodeRow[];
            return rows.map((row) => ({
                id: row.id,
                botId: row.bot_id,
                goalId: row.goal_id,
                kind: row.kind,
                summary: row.summary,
                position:
                    row.position_json === null
                        ? null
                        : (JSON.parse(row.position_json) as AgentEpisode['position']),
                relatedBotId: row.related_bot_id,
                payload: JSON.parse(row.payload_json) as unknown,
                createdAt: row.created_at,
            }));
        });
        if (error) return [null, StorageFailures.from('READ_FAILED', error)];
        if (episodes === null)
            return [null, StorageFailures.from('READ_FAILED', 'episodes missing')];
        return [episodes, null];
    }
}

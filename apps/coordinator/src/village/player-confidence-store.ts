import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';
import type { PlayerConfidence } from '@ticrafter/worldmodel';

import type { CoordinatorDatabase } from '../core/index.js';

export interface PlayerBaseLink {
    playerId: string;
    username: string;
    baseId: string;
    confidence?: number;
}

export interface PlayerConfidenceOptions {
    initialScore: number;
    halfLifeDays: number;
    linkMinSightings: number;
    linkWindowMs: number;
}

interface PlayerConfidenceRow {
    playerId: string;
    username: string;
    score: number;
    linkedBaseIdsJson: string;
    linkSightingsJson: string;
    lastInteractionAt: string | null;
    updatedAt: string;
}

interface StoredPlayerConfidence {
    playerId: string;
    username: string;
    score: number;
    linkedBaseIds: readonly string[];
    linkSightings: Readonly<Record<string, readonly string[]>>;
    lastInteractionAt: string | null;
    updatedAt: string;
}

const columns = `
    player_id AS playerId, username, score,
    linked_base_ids_json AS linkedBaseIdsJson,
    link_sightings_json AS linkSightingsJson,
    last_interaction_at AS lastInteractionAt,
    updated_at AS updatedAt
`;

export class PlayerConfidenceStore {
    constructor(
        private readonly database: CoordinatorDatabase,
        private readonly options: PlayerConfidenceOptions,
    ) {}

    seedLinks(
        links: readonly PlayerBaseLink[],
        now = new Date().toISOString(),
    ): Result<void, StorageFailure> {
        for (const link of links) {
            const [existing, readError] = this.read(link.playerId);
            if (readError) return [null, readError];
            const record = existing ?? this.empty(link.playerId, link.username, now);
            const linked = record.linkedBaseIds.includes(link.baseId)
                ? record.linkedBaseIds
                : [...record.linkedBaseIds, link.baseId];
            const [, writeError] = this.write({
                ...record,
                username: link.username,
                ...(link.confidence === undefined ? {} : { score: link.confidence }),
                linkedBaseIds: linked,
                updatedAt: now,
            });
            if (writeError) return [null, writeError];
        }
        return [undefined, null];
    }

    recordSighting(
        playerId: string,
        username: string,
        baseId: string,
        now = new Date().toISOString(),
    ): Result<PlayerConfidence, StorageFailure> {
        const [existing, readError] = this.read(playerId);
        if (readError) return [null, readError];
        const record = existing ?? this.empty(playerId, username, now);
        const cutoff = new Date(Date.parse(now) - this.options.linkWindowMs).toISOString();
        const recent = [...(record.linkSightings[baseId] ?? []), now].filter((at) => at >= cutoff);
        const linked =
            recent.length >= this.options.linkMinSightings && !record.linkedBaseIds.includes(baseId)
                ? [...record.linkedBaseIds, baseId]
                : record.linkedBaseIds;
        const next: StoredPlayerConfidence = {
            ...record,
            username,
            linkedBaseIds: linked,
            linkSightings: { ...record.linkSightings, [baseId]: recent },
            lastInteractionAt: now,
        };
        const [, writeError] = this.write(next);
        if (writeError) return [null, writeError];
        return [this.snapshot(next, now), null];
    }

    recordPermissionOutcome(
        playerId: string,
        kept: boolean,
        now = new Date().toISOString(),
    ): Result<PlayerConfidence, StorageFailure> {
        const [existing, readError] = this.read(playerId);
        if (readError) return [null, readError];
        if (existing === null) return [null, StorageFailures.from('READ_FAILED', 'player missing')];
        const next: StoredPlayerConfidence = {
            ...existing,
            score: this.clamp(existing.score + (kept ? 0.05 : -0.1)),
            lastInteractionAt: now,
            updatedAt: now,
        };
        const [, writeError] = this.write(next);
        if (writeError) return [null, writeError];
        return [this.snapshot(next, now), null];
    }

    linkedPlayers(
        baseId: string,
        now = new Date().toISOString(),
    ): Result<readonly PlayerConfidence[], StorageFailure> {
        const [rows, readError] = this.list(now);
        if (readError) return [null, readError];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'rows missing')];
        return [
            rows
                .filter((row) => row.linkedBaseIds.includes(baseId))
                .map((row) => this.snapshot(row, now)),
            null,
        ];
    }

    list(
        now = new Date().toISOString(),
    ): Result<readonly StoredPlayerConfidence[], StorageFailure> {
        const [rows, readError] = attempt<PlayerConfidenceRow[], unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${columns} FROM player_confidence ORDER BY player_id`)
                    .all() as PlayerConfidenceRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        return [(rows === null ? [] : rows).map((row) => this.decode(row, row.updatedAt)), null];
    }

    private read(playerId: string): Result<StoredPlayerConfidence | null, StorageFailure> {
        const [row, readError] = attempt<PlayerConfidenceRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${columns} FROM player_confidence WHERE player_id = ?`)
                    .get(playerId) as PlayerConfidenceRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        return [row === undefined || row === null ? null : this.decode(row, row.updatedAt), null];
    }

    private write(record: StoredPlayerConfidence): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO player_confidence (
                        player_id, username, score, linked_base_ids_json,
                        link_sightings_json, last_interaction_at, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(player_id) DO UPDATE SET
                        username = excluded.username,
                        score = excluded.score,
                        linked_base_ids_json = excluded.linked_base_ids_json,
                        link_sightings_json = excluded.link_sightings_json,
                        last_interaction_at = excluded.last_interaction_at,
                        updated_at = excluded.updated_at`,
                )
                .run(
                    record.playerId,
                    record.username,
                    record.score,
                    JSON.stringify(record.linkedBaseIds),
                    JSON.stringify(record.linkSightings),
                    record.lastInteractionAt,
                    record.updatedAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    private decode(row: PlayerConfidenceRow, now: string): StoredPlayerConfidence {
        return {
            playerId: row.playerId,
            username: row.username,
            score: this.decayed(row.score, row.updatedAt, now),
            linkedBaseIds: this.readStrings(row.linkedBaseIdsJson),
            linkSightings: this.readSightings(row.linkSightingsJson),
            lastInteractionAt: row.lastInteractionAt,
            updatedAt: row.updatedAt,
        };
    }

    private empty(playerId: string, username: string, now: string): StoredPlayerConfidence {
        return {
            playerId,
            username,
            score: this.options.initialScore,
            linkedBaseIds: [],
            linkSightings: {},
            lastInteractionAt: null,
            updatedAt: now,
        };
    }

    private snapshot(record: StoredPlayerConfidence, now: string): PlayerConfidence {
        return {
            playerId: record.playerId,
            username: record.username,
            score: this.decayed(record.score, record.updatedAt, now),
            linkedBaseIds: record.linkedBaseIds,
            lastInteractionAt: record.lastInteractionAt,
        };
    }

    private decayed(score: number, updatedAt: string, now: string): number {
        const elapsedDays = Math.max(0, Date.parse(now) - Date.parse(updatedAt)) / 86_400_000;
        return elapsedDays <= 0
            ? score
            : this.clamp(score * Math.pow(0.5, elapsedDays / this.options.halfLifeDays));
    }

    private readStrings(value: string): readonly string[] {
        const [parsed, error] = attempt<unknown>(() => JSON.parse(value));
        if (error !== null || !Array.isArray(parsed)) return [];
        return parsed.filter((entry): entry is string => typeof entry === 'string');
    }

    private readSightings(value: string): Record<string, readonly string[]> {
        const [parsed, error] = attempt<unknown>(() => JSON.parse(value));
        if (error !== null || typeof parsed !== 'object' || parsed === null) return {};
        const result: Record<string, readonly string[]> = {};
        for (const [key, entries] of Object.entries(parsed)) {
            if (!Array.isArray(entries)) continue;
            result[key] = entries.filter((entry): entry is string => typeof entry === 'string');
        }
        return result;
    }

    private clamp(value: number): number {
        return Math.min(1, Math.max(0, value));
    }
}

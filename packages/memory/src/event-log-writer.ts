import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export interface DomainEvent {
    botId?: string;
    type: string;
    payload?: unknown;
    actor?: string;
    causationId?: string;
    createdAt?: string;
}

interface EventRow {
    bot_id: string | null;
    type: string;
    payload_json: string;
    actor: string | null;
    causation_id: string | null;
    created_at: string;
}

export class EventLogWriter {
    constructor(private readonly database: Database) {}

    append(event: DomainEvent): Result<number, StorageFailure> {
        const [id, error] = attempt(() => {
            const result = this.database
                .prepare(
                    `INSERT INTO bot_events (bot_id, type, payload_json, actor, causation_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    event.botId ?? null,
                    event.type,
                    JSON.stringify(event.payload ?? {}),
                    event.actor ?? null,
                    event.causationId ?? null,
                    event.createdAt ?? new Date().toISOString(),
                );
            return Number(result.lastInsertRowid);
        });
        if (error) {
            return [null, StorageFailures.from('WRITE_FAILED', error)];
        }
        if (id === null) {
            return [null, StorageFailures.from('WRITE_FAILED', 'Event id missing')];
        }

        return [id, null];
    }

    list(limit = 100): Result<DomainEvent[], StorageFailure> {
        const [events, error] = attempt(() => {
            const rows = this.database
                .prepare(
                    'SELECT bot_id, type, payload_json, actor, causation_id, created_at FROM bot_events ORDER BY id DESC LIMIT ?',
                )
                .all(limit) as EventRow[];
            return rows.map((row) => ({
                botId: row.bot_id ?? undefined,
                type: row.type,
                payload: JSON.parse(row.payload_json) as unknown,
                actor: row.actor ?? undefined,
                causationId: row.causation_id ?? undefined,
                createdAt: row.created_at,
            }));
        });
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        if (events === null) {
            return [null, StorageFailures.from('READ_FAILED', 'Events missing')];
        }

        return [events, null];
    }
}

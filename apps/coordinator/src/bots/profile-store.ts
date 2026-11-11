import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { BotProfileCodec, type BotProfileRow } from './bot-codec.js';
import type { BotProfile } from './types.js';

const columnList = `
    id, name, role, profile_json, created_at, updated_at, status, last_seen, bot_index
`;

export class BotProfileStore {
    constructor(private readonly database: CoordinatorDatabase) {}

    save(profile: BotProfile): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO bots (
                        id, name, role, profile_json, created_at, updated_at, status,
                        last_seen, bot_index
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        role = excluded.role,
                        profile_json = excluded.profile_json,
                        updated_at = excluded.updated_at,
                        status = excluded.status,
                        last_seen = excluded.last_seen,
                        bot_index = excluded.bot_index`,
                )
                .run(
                    profile.botId,
                    profile.username,
                    profile.role,
                    BotProfileCodec.encode(profile),
                    profile.createdAt,
                    profile.updatedAt,
                    profile.status,
                    profile.lastSeen,
                    profile.botIndex,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(botId: string): Result<BotProfile | null, StorageFailure> {
        return this.read('SELECT ' + columnList + ' FROM bots WHERE id = ?', botId);
    }

    getByName(username: string): Result<BotProfile | null, StorageFailure> {
        return this.read('SELECT ' + columnList + ' FROM bots WHERE name = ?', username);
    }

    list(): Result<readonly BotProfile[], StorageFailure> {
        const [rows, readError] = attempt<BotProfileRow[], unknown>(
            () =>
                this.database
                    .prepare('SELECT ' + columnList + ' FROM bots ORDER BY bot_index, id')
                    .all() as BotProfileRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'bots missing')];
        return this.decodeAll(rows);
    }

    listOnline(): Result<readonly BotProfile[], StorageFailure> {
        const [rows, readError] = attempt<BotProfileRow[], unknown>(
            () =>
                this.database
                    .prepare(
                        'SELECT ' +
                            columnList +
                            " FROM bots WHERE status = 'online' ORDER BY bot_index, id",
                    )
                    .all() as BotProfileRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'bots missing')];
        return this.decodeAll(rows);
    }

    private read(sql: string, parameter: string): Result<BotProfile | null, StorageFailure> {
        const [row, readError] = attempt<BotProfileRow | undefined, unknown>(
            () => this.database.prepare(sql).get(parameter) as BotProfileRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return BotProfileCodec.decode(row);
    }

    private decodeAll(
        rows: readonly BotProfileRow[],
    ): Result<readonly BotProfile[], StorageFailure> {
        const profiles: BotProfile[] = [];
        for (const row of rows) {
            const [profile, decodeError] = BotProfileCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (profile !== null) profiles.push(profile);
        }
        return [profiles, null];
    }
}

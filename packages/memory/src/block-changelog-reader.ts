import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import type { BlockChange } from './block-changelog-writer.js';
import { type StorageFailure, StorageFailures } from './failures.js';

export interface StoredBlockChange extends BlockChange {
    id: number;
}

interface BlockChangeRow {
    id: number;
    bot_id: string;
    x: number;
    y: number;
    z: number;
    before_json: string | null;
    after_json: string | null;
    grant_id: string | null;
    claim_id: string | null;
    created_at: string;
}

export class BlockChangelogReader {
    constructor(private readonly database: Database) {}

    listAfter(id: number, limit = 1000): Result<StoredBlockChange[], StorageFailure> {
        const [changes, error] = attempt(() => {
            const rows = this.database
                .prepare(
                    `SELECT id, bot_id, x, y, z, before_json, after_json, grant_id, claim_id, created_at
                     FROM block_changelog WHERE id > ? ORDER BY id ASC LIMIT ?`,
                )
                .all(id, limit) as BlockChangeRow[];
            return rows.map((row) => BlockChangelogReader.decode(row));
        });
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        if (changes === null) {
            return [null, StorageFailures.from('READ_FAILED', 'Block changes missing')];
        }
        return [changes, null];
    }

    listByBot(botId: string, limit = 1000): Result<StoredBlockChange[], StorageFailure> {
        const [changes, error] = attempt(() => {
            const rows = this.database
                .prepare(
                    `SELECT id, bot_id, x, y, z, before_json, after_json, grant_id, claim_id, created_at
                     FROM block_changelog WHERE bot_id = ? ORDER BY id ASC LIMIT ?`,
                )
                .all(botId, limit) as BlockChangeRow[];
            return rows.map((row) => BlockChangelogReader.decode(row));
        });
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        if (changes === null) {
            return [null, StorageFailures.from('READ_FAILED', 'Block changes missing')];
        }
        return [changes, null];
    }

    private static decode(row: BlockChangeRow): StoredBlockChange {
        return {
            id: row.id,
            botId: row.bot_id,
            position: { x: row.x, y: row.y, z: row.z },
            ...(row.before_json === null ? {} : { before: JSON.parse(row.before_json) as unknown }),
            ...(row.after_json === null ? {} : { after: JSON.parse(row.after_json) as unknown }),
            ...(row.grant_id === null ? {} : { grantId: row.grant_id }),
            ...(row.claim_id === null ? {} : { claimId: row.claim_id }),
            createdAt: row.created_at,
        };
    }
}

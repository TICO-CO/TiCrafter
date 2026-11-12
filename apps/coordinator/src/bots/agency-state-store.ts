import type {
    AgencySnapshot,
    Intention,
    NeedsModel,
    PersonalityModel,
    RoutineState,
} from '@ticrafter/agency';
import { attempt, type Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';

export interface AgencyStateRecord {
    botId: string;
    traits: PersonalityModel;
    needs: NeedsModel;
    intention: Intention | null;
    routine: RoutineState;
    homeStructureId: string | null;
    personalStorageId: string | null;
    mood: string;
    lastDeliberationAt: string | null;
    updatedAt: string;
}

interface AgencyStateRow {
    bot_id: string;
    state_json: string;
    updated_at: string;
}

export interface AgencyStateStorePort {
    load(botId: string): Result<AgencyStateRecord | null, StorageFailure>;
    save(record: AgencyStateRecord): Result<void, StorageFailure>;
}

export class AgencyStateStore implements AgencyStateStorePort {
    constructor(private readonly database: CoordinatorDatabase) {}

    load(botId: string): Result<AgencyStateRecord | null, StorageFailure> {
        const [row, error] = attempt<AgencyStateRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(
                        'SELECT bot_id, state_json, updated_at FROM agent_state WHERE bot_id = ?',
                    )
                    .get(botId) as AgencyStateRow | undefined,
        );
        if (error) return [null, { type: 'READ_FAILED', message: String(error) }];
        if (row === undefined || row === null) return [null, null];
        const [record, decodeError] = this.decode(row);
        if (decodeError) return [null, decodeError];
        return [record, null];
    }

    save(record: AgencyStateRecord): Result<void, StorageFailure> {
        const [, error] = attempt(() => {
            this.database
                .prepare(
                    `INSERT INTO agent_state (bot_id, state_json, updated_at)
                     VALUES (?, ?, ?)
                     ON CONFLICT(bot_id) DO UPDATE SET
                        state_json = excluded.state_json,
                        updated_at = excluded.updated_at`,
                )
                .run(record.botId, JSON.stringify(this.encode(record)), record.updatedAt);
        });
        if (error) return [null, { type: 'WRITE_FAILED', message: String(error) }];
        return [undefined, null];
    }

    private encode(record: AgencyStateRecord): unknown {
        return {
            botId: record.botId,
            traits: record.traits.traits,
            needs: record.needs.levels,
            intention: record.intention,
            routine: record.routine,
            homeStructureId: record.homeStructureId,
            personalStorageId: record.personalStorageId,
            mood: record.mood,
            lastDeliberationAt: record.lastDeliberationAt,
            updatedAt: record.updatedAt,
        };
    }

    private decode(row: AgencyStateRow): Result<AgencyStateRecord, StorageFailure> {
        const [decoded, error] = attempt(() => JSON.parse(row.state_json) as AgencyStateRecord);
        if (error) return [null, { type: 'READ_FAILED', message: String(error) }];
        if (decoded === null) return [null, { type: 'READ_FAILED', message: 'state missing' }];
        return [decoded, null];
    }
}

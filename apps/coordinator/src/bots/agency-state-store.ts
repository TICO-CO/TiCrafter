import { type Intention, NeedsModel, PersonalityModel, type RoutineState } from '@ticrafter/agency';
import { type AgencyStatePayload, agencyStateSchema, attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

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
        if (error) return [null, StorageFailures.from('READ_FAILED', error)];
        if (row === undefined || row === null) return [null, null];
        const [record, decodeError] = this.decode(row);
        if (decodeError) return [null, decodeError];
        return [record, null];
    }

    saveSnapshot(
        botId: string,
        snapshot: AgencyStatePayload,
        updatedAt: string,
    ): Result<void, StorageFailure> {
        const [traits, traitsError] = PersonalityModel.restore(snapshot.traits);
        if (traitsError) return [null, StorageFailures.from('WRITE_FAILED', traitsError)];
        if (traits === null) return [null, StorageFailures.from('WRITE_FAILED', 'traits missing')];
        const [needs, needsError] = NeedsModel.restore(snapshot.needs);
        if (needsError) return [null, StorageFailures.from('WRITE_FAILED', needsError)];
        if (needs === null) return [null, StorageFailures.from('WRITE_FAILED', 'needs missing')];
        return this.save({
            botId,
            traits,
            needs,
            intention: snapshot.intention,
            routine: snapshot.routine,
            homeStructureId: snapshot.homeStructureId,
            personalStorageId: snapshot.personalStorageId,
            mood: snapshot.mood,
            lastDeliberationAt: snapshot.lastDeliberationAt,
            updatedAt,
        });
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
        if (error) return [null, StorageFailures.from('WRITE_FAILED', error)];
        return [undefined, null];
    }

    private encode(record: AgencyStateRecord): unknown {
        return {
            traits: record.traits.traits,
            needs: record.needs.levels,
            intention: record.intention,
            routine: record.routine,
            homeStructureId: record.homeStructureId,
            personalStorageId: record.personalStorageId,
            mood: record.mood,
            lastDeliberationAt: record.lastDeliberationAt,
        };
    }

    private decode(row: AgencyStateRow): Result<AgencyStateRecord, StorageFailure> {
        const [decoded, decodeError] = attempt(() => JSON.parse(row.state_json) as unknown);
        if (decodeError) return [null, StorageFailures.from('READ_FAILED', decodeError)];
        const parsed = agencyStateSchema.safeParse(decoded);
        if (!parsed.success) {
            return [null, StorageFailures.from('READ_FAILED', parsed.error.message)];
        }
        const [traits, traitsError] = PersonalityModel.restore(parsed.data.traits);
        if (traitsError) return [null, StorageFailures.from('READ_FAILED', traitsError)];
        if (traits === null) {
            return [null, StorageFailures.from('READ_FAILED', 'traits missing')];
        }
        const [needs, needsError] = NeedsModel.restore(parsed.data.needs);
        if (needsError) return [null, StorageFailures.from('READ_FAILED', needsError)];
        if (needs === null) return [null, StorageFailures.from('READ_FAILED', 'needs missing')];
        return [
            {
                botId: row.bot_id,
                traits,
                needs,
                intention: parsed.data.intention,
                routine: parsed.data.routine,
                homeStructureId: parsed.data.homeStructureId,
                personalStorageId: parsed.data.personalStorageId,
                mood: parsed.data.mood,
                lastDeliberationAt: parsed.data.lastDeliberationAt,
                updatedAt: row.updated_at,
            },
            null,
        ];
    }
}

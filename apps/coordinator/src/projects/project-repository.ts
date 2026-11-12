import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { PersonalProjectCodec, type PersonalProjectRow } from './project-codec.js';
import type { PersonalProjectRecord } from './types.js';

const columnList = `
    id, bot_id, title, kind, status, anchor_json, bbox_json, claims_json,
    structure_id, storage_id, reason, created_at, updated_at
`;

export class PersonalProjectRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    insert(record: PersonalProjectRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO personal_projects (
                        id, bot_id, title, kind, status, anchor_json, bbox_json,
                        claims_json, structure_id, storage_id, reason, created_at, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    record.id,
                    record.botId,
                    record.title,
                    record.kind,
                    record.status,
                    PersonalProjectCodec.encodeAnchor(record.anchor),
                    PersonalProjectCodec.encodeBbox(record.bbox),
                    PersonalProjectCodec.encodeClaims(record.claims),
                    record.structureId,
                    record.storageId,
                    record.reason,
                    record.createdAt,
                    record.updatedAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    update(record: PersonalProjectRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `UPDATE personal_projects SET
                        title = ?, kind = ?, status = ?, anchor_json = ?, bbox_json = ?,
                        claims_json = ?, structure_id = ?, storage_id = ?, reason = ?,
                        updated_at = ?
                     WHERE id = ?`,
                )
                .run(
                    record.title,
                    record.kind,
                    record.status,
                    PersonalProjectCodec.encodeAnchor(record.anchor),
                    PersonalProjectCodec.encodeBbox(record.bbox),
                    PersonalProjectCodec.encodeClaims(record.claims),
                    record.structureId,
                    record.storageId,
                    record.reason,
                    record.updatedAt,
                    record.id,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(projectId: string): Result<PersonalProjectRecord | null, StorageFailure> {
        return this.read(
            'SELECT ' + columnList + ' FROM personal_projects WHERE id = ?',
            projectId,
        );
    }

    listByBot(botId: string): Result<readonly PersonalProjectRecord[], StorageFailure> {
        return this.list(
            'SELECT ' +
                columnList +
                ' FROM personal_projects WHERE bot_id = ? ORDER BY created_at, id',
            botId,
        );
    }

    listActive(): Result<readonly PersonalProjectRecord[], StorageFailure> {
        return this.list(
            'SELECT ' +
                columnList +
                " FROM personal_projects WHERE status IN ('proposed', 'active') ORDER BY created_at, id",
        );
    }

    findByStructureId(structureId: string): Result<PersonalProjectRecord | null, StorageFailure> {
        return this.read(
            'SELECT ' + columnList + ' FROM personal_projects WHERE structure_id = ?',
            structureId,
        );
    }

    private read(
        sql: string,
        parameter: string,
    ): Result<PersonalProjectRecord | null, StorageFailure> {
        const [row, readError] = attempt<PersonalProjectRow | undefined, unknown>(
            () => this.database.prepare(sql).get(parameter) as PersonalProjectRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return PersonalProjectCodec.decode(row);
    }

    private list(
        sql: string,
        ...parameters: unknown[]
    ): Result<readonly PersonalProjectRecord[], StorageFailure> {
        const [rows, readError] = attempt<PersonalProjectRow[], unknown>(
            () => this.database.prepare(sql).all(...parameters) as PersonalProjectRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'projects missing')];
        const records: PersonalProjectRecord[] = [];
        for (const row of rows) {
            const [record, decodeError] = PersonalProjectCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (record !== null) records.push(record);
        }
        return [records, null];
    }
}

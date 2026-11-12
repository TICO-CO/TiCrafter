import type { BlueprintDocument } from '@ticrafter/building';
import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { BlueprintDocumentCodec, type BlueprintDocumentRow } from './blueprint-codec.js';

const columnList = `
    id, revision, hash, source, blueprint_json, provenance_json, created_at
`;

export class BlueprintDocumentRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    insert(document: BlueprintDocument): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO blueprint_documents (
                        id, revision, hash, source, blueprint_json, provenance_json, created_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    document.id,
                    document.revision,
                    document.hash,
                    document.source,
                    BlueprintDocumentCodec.encodeBlueprint(document.blueprint),
                    BlueprintDocumentCodec.encodeProvenance(document.provenance),
                    document.provenance.createdAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    get(id: string, revision: number): Result<BlueprintDocument | null, StorageFailure> {
        return this.read(
            `SELECT ${columnList} FROM blueprint_documents WHERE id = ? AND revision = ?`,
            id,
            revision,
        );
    }

    getLatest(id: string): Result<BlueprintDocument | null, StorageFailure> {
        return this.read(
            `SELECT ${columnList} FROM blueprint_documents
             WHERE id = ? ORDER BY revision DESC LIMIT 1`,
            id,
        );
    }

    list(id: string): Result<readonly BlueprintDocument[], StorageFailure> {
        const [rows, readError] = attempt<BlueprintDocumentRow[], unknown>(
            () =>
                this.database
                    .prepare(
                        `SELECT ${columnList} FROM blueprint_documents
                         WHERE id = ? ORDER BY revision ASC`,
                    )
                    .all(id) as BlueprintDocumentRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'blueprints missing')];
        const documents: BlueprintDocument[] = [];
        for (const row of rows) {
            const [document, decodeError] = BlueprintDocumentCodec.decode(row);
            if (decodeError) return [null, decodeError];
            if (document !== null) documents.push(document);
        }
        return [documents, null];
    }

    private read(
        sql: string,
        ...parameters: unknown[]
    ): Result<BlueprintDocument | null, StorageFailure> {
        const [row, readError] = attempt<BlueprintDocumentRow | undefined, unknown>(
            () => this.database.prepare(sql).get(...parameters) as BlueprintDocumentRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [null, null];
        return BlueprintDocumentCodec.decode(row);
    }
}

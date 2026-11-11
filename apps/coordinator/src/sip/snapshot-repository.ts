import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { SipSnapshotCodec } from './snapshot-codec.js';
import type { SipCommit, SipSnapshot } from './types.js';

interface SnapshotRow {
    revision: number;
    payloadJson: string;
}

interface RevisionRow {
    revision: number;
    payloadJson: string;
    createdAt: string;
}

export class SipSnapshotRepository {
    constructor(private readonly database: CoordinatorDatabase) {}

    load(): Result<SipSnapshot, StorageFailure> {
        const [row, readError] = attempt<SnapshotRow | undefined, unknown>(
            () =>
                this.database
                    .prepare('SELECT revision, payload_json AS payloadJson FROM sip WHERE id = 1')
                    .get() as SnapshotRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (row === null || row === undefined) return [SipSnapshotCodec.defaults(), null];
        const [snapshot, decodeError] = SipSnapshotCodec.decode(row.payloadJson);
        if (decodeError) return [null, StorageFailures.from('READ_FAILED', decodeError)];
        if (snapshot === null) return [null, StorageFailures.from('READ_FAILED', 'no snapshot')];
        return [{ ...snapshot, revision: row.revision }, null];
    }

    findByIdempotencyKey(idempotencyKey: string): Result<SipCommit | null, StorageFailure> {
        const [rows, readError] = attempt<RevisionRow[], unknown>(
            () =>
                this.database
                    .prepare(
                        `SELECT revision, payload_json AS payloadJson, created_at AS createdAt
                         FROM sip_revisions ORDER BY revision DESC`,
                    )
                    .all() as RevisionRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        if (rows === null) return [null, StorageFailures.from('READ_FAILED', 'no rows')];
        for (const row of rows) {
            const [record, decodeError] = SipSnapshotCodec.decodeRevision(row.payloadJson);
            if (decodeError) return [null, StorageFailures.from('READ_FAILED', decodeError)];
            if (record === null) continue;
            if (record.metadata.idempotencyKey !== idempotencyKey) continue;
            return [
                {
                    revision: row.revision,
                    snapshot: { ...record.snapshot, revision: row.revision },
                    metadata: record.metadata,
                    committedAt: row.createdAt,
                },
                null,
            ];
        }
        return [null, null];
    }

    write(snapshot: SipSnapshot, updatedAt: string): Result<void, StorageFailure> {
        const [payloadJson, encodeError] = SipSnapshotCodec.encode(snapshot);
        if (encodeError) return [null, StorageFailures.from('WRITE_FAILED', encodeError)];
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO sip (id, revision, payload_json, updated_at)
                     VALUES (1, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                         revision = excluded.revision,
                         payload_json = excluded.payload_json,
                         updated_at = excluded.updated_at`,
                )
                .run(snapshot.revision, payloadJson, updatedAt);
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    appendRevision(commit: SipCommit): Result<void, StorageFailure> {
        const [payloadJson, encodeError] = SipSnapshotCodec.encodeRevision(
            commit.snapshot,
            commit.metadata,
        );
        if (encodeError) return [null, StorageFailures.from('WRITE_FAILED', encodeError)];
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    'INSERT INTO sip_revisions (revision, payload_json, created_at) VALUES (?, ?, ?)',
                )
                .run(commit.revision, payloadJson, commit.committedAt);
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }
}

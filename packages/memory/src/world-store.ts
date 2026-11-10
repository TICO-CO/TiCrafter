import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';
import { TransactionManager } from './transaction-manager.js';

export interface ChunkRecord {
    x: number;
    z: number;
    version: number;
    payloadJson: string;
    updatedAt: string;
}

export interface LandmarkRecord {
    id: string;
    type: string;
    x: number;
    y: number;
    z: number;
    confidence: number;
    bboxJson: string;
    anchorsJson: string;
    evidenceJson: string;
    confidenceUpdatedAt: string | null;
    lastSeen: string;
    planId: string | null;
    updatedAt: string;
}

export interface ContainerObservationRecord {
    id: string;
    positionJson: string;
    role: string;
    contentsJson: string | null;
    observedAt: string;
    confidence: number;
    updatedAt: string;
}

export class WorldStore {
    constructor(
        private readonly database: Database,
        private readonly transactions = new TransactionManager(database),
    ) {}

    getChunk(x: number, z: number): Result<ChunkRecord | null, StorageFailure> {
        const [record, error] = attempt(
            () =>
                this.database
                    .prepare(
                        'SELECT x, z, version, payload_json AS payloadJson, updated_at AS updatedAt FROM chunks WHERE x = ? AND z = ?',
                    )
                    .get(x, z) as ChunkRecord | undefined,
        );
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        return [record ?? null, null];
    }

    listChunks(): Result<readonly ChunkRecord[], StorageFailure> {
        const [records, error] = attempt(
            () =>
                this.database
                    .prepare(
                        'SELECT x, z, version, payload_json AS payloadJson, updated_at AS updatedAt FROM chunks ORDER BY x, z',
                    )
                    .all() as ChunkRecord[],
        );
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        return [records, null];
    }

    saveChunk(record: ChunkRecord): Result<void, StorageFailure> {
        const [, error] = this.transactions.run(() => {
            this.database
                .prepare(
                    `INSERT INTO chunks (x, z, version, payload_json, updated_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(x, z) DO UPDATE SET
                         version = excluded.version,
                         payload_json = excluded.payload_json,
                         updated_at = excluded.updated_at`,
                )
                .run(record.x, record.z, record.version, record.payloadJson, record.updatedAt);
        });
        if (error) return [null, error];
        return [undefined, null];
    }

    getLandmark(id: string): Result<LandmarkRecord | null, StorageFailure> {
        const [record, error] = attempt(
            () =>
                this.database
                    .prepare(
                        `SELECT id, type, x, y, z, confidence,
                                bbox_json AS bboxJson,
                                anchors_json AS anchorsJson,
                                evidence_json AS evidenceJson,
                                confidence_updated_at AS confidenceUpdatedAt,
                                last_seen AS lastSeen,
                                plan_id AS planId,
                                updated_at AS updatedAt
                         FROM landmarks WHERE id = ?`,
                    )
                    .get(id) as LandmarkRecord | undefined,
        );
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        return [record ?? null, null];
    }

    listLandmarks(): Result<readonly LandmarkRecord[], StorageFailure> {
        const [records, error] = attempt(
            () =>
                this.database
                    .prepare(
                        `SELECT id, type, x, y, z, confidence,
                                bbox_json AS bboxJson,
                                anchors_json AS anchorsJson,
                                evidence_json AS evidenceJson,
                                confidence_updated_at AS confidenceUpdatedAt,
                                last_seen AS lastSeen,
                                plan_id AS planId,
                                updated_at AS updatedAt
                         FROM landmarks ORDER BY id`,
                    )
                    .all() as LandmarkRecord[],
        );
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        return [records, null];
    }

    saveLandmark(record: LandmarkRecord): Result<void, StorageFailure> {
        const [, error] = this.transactions.run(() => {
            this.database
                .prepare(
                    `INSERT INTO landmarks
                         (id, type, x, y, z, confidence, bbox_json, anchors_json,
                          evidence_json, confidence_updated_at, last_seen, plan_id, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                         type = excluded.type,
                         x = excluded.x,
                         y = excluded.y,
                         z = excluded.z,
                         confidence = excluded.confidence,
                         bbox_json = excluded.bbox_json,
                         anchors_json = excluded.anchors_json,
                         evidence_json = excluded.evidence_json,
                         confidence_updated_at = excluded.confidence_updated_at,
                         last_seen = excluded.last_seen,
                         plan_id = excluded.plan_id,
                         updated_at = excluded.updated_at`,
                )
                .run(
                    record.id,
                    record.type,
                    record.x,
                    record.y,
                    record.z,
                    record.confidence,
                    record.bboxJson,
                    record.anchorsJson,
                    record.evidenceJson,
                    record.confidenceUpdatedAt,
                    record.lastSeen,
                    record.planId,
                    record.updatedAt,
                );
        });
        if (error) return [null, error];
        return [undefined, null];
    }

    getContainerObservation(id: string): Result<ContainerObservationRecord | null, StorageFailure> {
        const [record, error] = attempt(
            () =>
                this.database
                    .prepare(
                        `SELECT id,
                                position_json AS positionJson,
                                role,
                                contents_json AS contentsJson,
                                observed_at AS observedAt,
                                confidence,
                                updated_at AS updatedAt
                         FROM world_container_observations WHERE id = ?`,
                    )
                    .get(id) as ContainerObservationRecord | undefined,
        );
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        return [record ?? null, null];
    }

    listContainerObservations(): Result<readonly ContainerObservationRecord[], StorageFailure> {
        const [records, error] = attempt(
            () =>
                this.database
                    .prepare(
                        `SELECT id,
                                position_json AS positionJson,
                                role,
                                contents_json AS contentsJson,
                                observed_at AS observedAt,
                                confidence,
                                updated_at AS updatedAt
                         FROM world_container_observations ORDER BY id`,
                    )
                    .all() as ContainerObservationRecord[],
        );
        if (error) {
            return [null, StorageFailures.from('READ_FAILED', error)];
        }
        return [records, null];
    }

    saveContainerObservation(record: ContainerObservationRecord): Result<void, StorageFailure> {
        const [, error] = this.transactions.run(() => {
            this.database
                .prepare(
                    `INSERT INTO world_container_observations
                         (id, position_json, role, contents_json, observed_at, confidence, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                         position_json = excluded.position_json,
                         role = excluded.role,
                         contents_json = excluded.contents_json,
                         observed_at = excluded.observed_at,
                         confidence = excluded.confidence,
                         updated_at = excluded.updated_at`,
                )
                .run(
                    record.id,
                    record.positionJson,
                    record.role,
                    record.contentsJson,
                    record.observedAt,
                    record.confidence,
                    record.updatedAt,
                );
        });
        if (error) return [null, error];
        return [undefined, null];
    }
}

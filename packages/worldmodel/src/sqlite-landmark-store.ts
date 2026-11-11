import { attempt, type Result } from '@ticrafter/core';
import { type LandmarkRecord, WorldStore } from '@ticrafter/memory';

import { WorldFailures } from './failures.js';
import type { LandmarkStorePort } from './landmark-registry.js';
import type {
    BoundingBox,
    Landmark,
    LandmarkAnchor,
    LandmarkEvidence,
    LandmarkType,
    WorldFailure,
} from './types.js';

export class SqliteLandmarkStore implements LandmarkStorePort {
    constructor(private readonly store: WorldStore) {}

    get(id: string): Result<Landmark | null, WorldFailure> {
        const [record, readError] = this.store.getLandmark(id);
        if (readError) {
            return [null, WorldFailures.storageFailed(readError.message)];
        }
        if (record === null) {
            return [null, null];
        }
        return this.toLandmark(record);
    }

    list(): Result<readonly Landmark[], WorldFailure> {
        const [records, readError] = this.store.listLandmarks();
        if (readError) {
            return [null, WorldFailures.storageFailed(readError.message)];
        }
        if (records === null) {
            return [null, WorldFailures.landmarkListUnavailable()];
        }
        const landmarks: Landmark[] = [];
        for (const record of records) {
            const [landmark, mappingError] = this.toLandmark(record);
            if (mappingError) {
                return [null, mappingError];
            }
            if (landmark !== null) {
                landmarks.push(landmark);
            }
        }
        return [landmarks, null];
    }

    save(landmark: Landmark): Result<void, WorldFailure> {
        const [, writeError] = this.store.saveLandmark(SqliteLandmarkStore.toRecord(landmark));
        if (writeError) {
            return [null, WorldFailures.storageFailed(writeError.message)];
        }
        return [undefined, null];
    }

    private toLandmark(record: LandmarkRecord): Result<Landmark, WorldFailure> {
        const type = SqliteLandmarkStore.landmarkType(record.type);
        if (type === null) {
            return [null, WorldFailures.storageFailed(`unknown landmark type ${record.type}`)];
        }
        const [bbox, bboxError] = SqliteLandmarkStore.parse<BoundingBox>(record.bboxJson);
        if (bboxError) {
            return [null, bboxError];
        }
        if (bbox === null) {
            return [null, WorldFailures.storageFailed('bbox is missing')];
        }
        const [anchors, anchorsError] = SqliteLandmarkStore.parse<LandmarkAnchor[]>(
            record.anchorsJson,
        );
        if (anchorsError) {
            return [null, anchorsError];
        }
        if (anchors === null || !Array.isArray(anchors)) {
            return [null, WorldFailures.storageFailed('anchors must be an array')];
        }
        const [evidence, evidenceError] = SqliteLandmarkStore.parse<LandmarkEvidence[]>(
            record.evidenceJson,
        );
        if (evidenceError) {
            return [null, evidenceError];
        }
        if (evidence === null || !Array.isArray(evidence)) {
            return [null, WorldFailures.storageFailed('evidence must be an array')];
        }
        return [
            {
                id: record.id,
                type,
                bbox,
                anchors,
                confidence: record.confidence,
                confidenceUpdatedAt: record.confidenceUpdatedAt ?? record.lastSeen,
                lastSeen: record.lastSeen,
                evidence,
                planId: record.planId,
            },
            null,
        ];
    }

    private static toRecord(landmark: Landmark): LandmarkRecord {
        return {
            id: landmark.id,
            type: landmark.type,
            x: landmark.bbox.min.x,
            y: landmark.bbox.min.y,
            z: landmark.bbox.min.z,
            confidence: landmark.confidence,
            bboxJson: JSON.stringify(landmark.bbox),
            anchorsJson: JSON.stringify(landmark.anchors),
            evidenceJson: JSON.stringify(landmark.evidence),
            confidenceUpdatedAt: landmark.confidenceUpdatedAt,
            lastSeen: landmark.lastSeen,
            planId: landmark.planId,
            updatedAt: landmark.lastSeen,
        };
    }

    private static parse<T>(value: string): Result<T, WorldFailure> {
        const [parsed, parseError] = attempt(() => JSON.parse(value) as T);
        if (parseError) {
            return [null, WorldFailures.storageFailed('invalid stored landmark JSON')];
        }
        return [parsed, null];
    }

    private static landmarkType(value: string): LandmarkType | null {
        switch (value) {
            case 'path':
            case 'house':
            case 'farm':
            case 'storage':
            case 'workstation':
            case 'wall':
            case 'bridge':
            case 'mineshaft':
            case 'container':
                return value;
            default:
                return null;
        }
    }
}

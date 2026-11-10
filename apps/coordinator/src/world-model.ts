import type {
    ChunkSnapshotMessage,
    LandmarkCandidateMessage,
    LoggerPort,
    Result,
} from '@ticrafter/core';
import { WorldStore } from '@ticrafter/memory';
import {
    type BoundingBox,
    ConfidenceDecay,
    type LandmarkCandidate,
    LandmarkRegistry,
    MergeConflictResolver,
    ObservationIngestor,
    SqliteChunkStore,
    SqliteLandmarkStore,
    type WorldFailure,
} from '@ticrafter/worldmodel';

import type { CoordinatorDatabase } from './core/index.js';

const dayMilliseconds = 24 * 60 * 60 * 1000;

export class CoordinatorWorldModel {
    private readonly chunks: ObservationIngestor;
    private readonly landmarks: LandmarkRegistry;

    constructor(
        database: CoordinatorDatabase,
        private readonly logger: LoggerPort,
    ) {
        const store = new WorldStore(database);
        const decay = new ConfidenceDecay({
            halfLifeMilliseconds: dayMilliseconds,
            verificationThreshold: 0.3,
        });
        this.chunks = new ObservationIngestor(new SqliteChunkStore(store));
        this.landmarks = new LandmarkRegistry(
            new SqliteLandmarkStore(store),
            new MergeConflictResolver(decay),
        );
    }

    ingestChunk(payload: ChunkSnapshotMessage): Result<void, string> {
        const [result, ingestError] = this.chunks.ingest({
            botId: payload.botId,
            chunk: payload.chunk,
            version: payload.version,
            observedAt: payload.observedAt,
            blocks: payload.blocks,
        });
        if (ingestError) return [null, CoordinatorWorldModel.failure(ingestError)];
        if (result !== null) {
            this.logger.debug(
                { chunk: result.chunk, version: result.version, outcome: result.outcome },
                'chunk observation ingested',
            );
        }
        return [undefined, null];
    }

    ingestLandmark(payload: LandmarkCandidateMessage): Result<void, string> {
        const [landmarkId, landmarkIdError] = this.landmarkId(payload);
        if (landmarkIdError) return [null, landmarkIdError];
        if (landmarkId === null) return [null, 'landmark id missing'];
        const candidate: LandmarkCandidate = {
            id: landmarkId,
            type: payload.candidate.type,
            bbox: payload.candidate.bbox,
            anchors: payload.candidate.anchors,
            confidence: payload.candidate.confidence,
            observedAt: payload.observedAt,
            evidence: {
                sourceBotId: payload.botId,
                observedAt: payload.observedAt,
                confidence: payload.candidate.confidence,
                reliability: payload.candidate.confidence,
                details: payload.candidate.evidence,
            },
            planId: null,
        };
        const [result, upsertError] = this.landmarks.upsert(candidate, payload.observedAt);
        if (upsertError) return [null, CoordinatorWorldModel.failure(upsertError)];
        if (result !== null) {
            this.logger.debug(
                { landmarkId: result.landmark.id, outcome: result.outcome },
                'landmark candidate ingested',
            );
        }
        return [undefined, null];
    }

    private landmarkId(payload: LandmarkCandidateMessage): Result<string, string> {
        const [existing, listError] = this.landmarks.list();
        if (listError) return [null, CoordinatorWorldModel.failure(listError)];
        if (existing === null) return [null, 'landmark list returned null'];
        const match = existing.find(
            (landmark) =>
                landmark.type === payload.candidate.type &&
                CoordinatorWorldModel.overlap(landmark.bbox, payload.candidate.bbox) >= 0.5,
        );
        if (match !== undefined) return [match.id, null];
        const { min, max } = payload.candidate.bbox;
        return [
            ['landmark', payload.candidate.type, min.x, min.y, min.z, max.x, max.y, max.z].join(
                ':',
            ),
            null,
        ];
    }

    private static overlap(left: BoundingBox, right: BoundingBox): number {
        const intersection =
            CoordinatorWorldModel.axisOverlap(left.min.x, left.max.x, right.min.x, right.max.x) *
            CoordinatorWorldModel.axisOverlap(left.min.y, left.max.y, right.min.y, right.max.y) *
            CoordinatorWorldModel.axisOverlap(left.min.z, left.max.z, right.min.z, right.max.z);
        if (intersection <= 0) return 0;
        const union =
            CoordinatorWorldModel.volume(left) + CoordinatorWorldModel.volume(right) - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    private static axisOverlap(
        leftMinimum: number,
        leftMaximum: number,
        rightMinimum: number,
        rightMaximum: number,
    ): number {
        return Math.max(
            0,
            Math.min(leftMaximum, rightMaximum) - Math.max(leftMinimum, rightMinimum) + 1,
        );
    }

    private static volume(bounds: BoundingBox): number {
        return (
            (bounds.max.x - bounds.min.x + 1) *
            (bounds.max.y - bounds.min.y + 1) *
            (bounds.max.z - bounds.min.z + 1)
        );
    }

    private static failure(failure: WorldFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }
}

import { EventStream, ProtocolEnvelope, type Result, type TransportFailure } from '@ticrafter/core';

import type { DetectorPipeline } from './detector-pipeline.js';
import type { ChunkCoordinate, ChunkSnapshot, DetectionCandidate } from './types.js';

export const LANDMARK_CANDIDATE_EVENT = 'landmark.candidate';

export interface LandmarkCandidatePayload {
    botId: string;
    chunk: ChunkCoordinate;
    observedAt: string;
    candidate: DetectionCandidate;
}

export class LandmarkCandidateEmitter {
    constructor(
        private readonly pipeline: DetectorPipeline,
        private readonly events: EventStream,
    ) {}

    emit(snapshot: ChunkSnapshot): Result<readonly DetectionCandidate[], TransportFailure> {
        const candidates = this.pipeline.run(snapshot);
        for (const candidate of candidates) {
            const [, publishError] = this.events.publish(
                ProtocolEnvelope.create('event', LANDMARK_CANDIDATE_EVENT, {
                    botId: snapshot.botId,
                    chunk: snapshot.chunk,
                    observedAt: snapshot.observedAt,
                    candidate,
                } satisfies LandmarkCandidatePayload),
            );
            if (publishError) {
                return [null, publishError];
            }
        }
        return [candidates, null];
    }
}

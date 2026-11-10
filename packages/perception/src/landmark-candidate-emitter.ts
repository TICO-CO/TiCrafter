import {
    EventStream,
    LANDMARK_CANDIDATE_EVENT,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { DetectorPipeline } from './detector-pipeline.js';
import type { ChunkCoordinate, ChunkSnapshot, DetectionCandidate } from './types.js';

export { LANDMARK_CANDIDATE_EVENT };

export interface LandmarkCandidatePayload {
    botId: string;
    chunk: ChunkCoordinate;
    observedAt: string;
    candidate: DetectionCandidate;
}

export interface LandmarkCandidateEmitterOptions {
    dedupeWindowMilliseconds?: number;
    clock?: () => number;
}

interface SeenCandidate {
    at: number;
    confidence: number;
}

export class LandmarkCandidateEmitter {
    private readonly seen = new Map<string, SeenCandidate>();
    private readonly dedupeWindowMilliseconds: number;
    private readonly clock: () => number;

    constructor(
        private readonly pipeline: DetectorPipeline,
        private readonly events: EventStream,
        options: LandmarkCandidateEmitterOptions = {},
    ) {
        this.dedupeWindowMilliseconds = options.dedupeWindowMilliseconds ?? 60_000;
        this.clock = options.clock ?? (() => Date.now());
    }

    emit(snapshot: ChunkSnapshot): Result<readonly DetectionCandidate[], TransportFailure> {
        const now = this.clock();
        this.prune(now);
        const candidates = this.pipeline
            .run(snapshot)
            .filter((candidate) => this.shouldEmit(candidate, now));
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

    private shouldEmit(candidate: DetectionCandidate, now: number): boolean {
        const key = LandmarkCandidateEmitter.key(candidate);
        const previous = this.seen.get(key);
        const shouldEmit =
            previous === undefined ||
            now - previous.at >= this.dedupeWindowMilliseconds ||
            candidate.confidence > previous.confidence;
        if (shouldEmit) {
            this.seen.set(key, { at: now, confidence: candidate.confidence });
        }
        return shouldEmit;
    }

    private prune(now: number): void {
        this.seen.forEach((seen, key) => {
            if (now - seen.at >= this.dedupeWindowMilliseconds) this.seen.delete(key);
        });
    }

    private static key(candidate: DetectionCandidate): string {
        const { min, max } = candidate.bbox;
        return [candidate.type, min.x, min.y, min.z, max.x, max.y, max.z].join(':');
    }
}

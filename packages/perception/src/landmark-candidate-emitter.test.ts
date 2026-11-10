import { type Envelope, EventStream } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { DetectorPipeline } from './detector-pipeline.js';
import {
    LANDMARK_CANDIDATE_EVENT,
    LandmarkCandidateEmitter,
    type LandmarkCandidatePayload,
} from './landmark-candidate-emitter.js';
import { PathDetector } from './path-detector.js';
import type { ChunkSnapshot, VoxelBlock } from './types.js';

function corridor(): readonly VoxelBlock[] {
    return Array.from({ length: 10 }, (_, index) => ({
        position: { x: index, y: 64, z: 0 },
        blockId: 'stone',
        solid: true,
    }));
}

const snapshot: ChunkSnapshot = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 1,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: corridor(),
};

function payloadOf(envelope: Envelope | undefined): LandmarkCandidatePayload | null {
    const payload = envelope?.payload;
    if (typeof payload !== 'object' || payload === null) return null;
    return payload as LandmarkCandidatePayload;
}

describe('LandmarkCandidateEmitter', () => {
    it('publishes each detected landmark candidate', () => {
        const events = new EventStream();
        const received: Envelope[] = [];
        events.subscribe(LANDMARK_CANDIDATE_EVENT, (envelope) => received.push(envelope));
        const emitter = new LandmarkCandidateEmitter(
            new DetectorPipeline([new PathDetector()]),
            events,
        );

        const [candidates, error] = emitter.emit(snapshot);

        expect(error).toBeNull();
        expect(candidates).toHaveLength(1);
        expect(received).toHaveLength(1);
        expect(received[0]?.type).toBe(LANDMARK_CANDIDATE_EVENT);
        expect(payloadOf(received[0])?.botId).toBe('bot.tibot1');
        expect(payloadOf(received[0])?.candidate.type).toBe('path');
    });

    it('publishes nothing when no landmarks are detected', () => {
        const events = new EventStream();
        const received: Envelope[] = [];
        events.subscribe('*', (envelope) => received.push(envelope));
        const emitter = new LandmarkCandidateEmitter(
            new DetectorPipeline([new PathDetector()]),
            events,
        );

        const [candidates, error] = emitter.emit({ ...snapshot, blocks: [] });

        expect(error).toBeNull();
        expect(candidates).toHaveLength(0);
        expect(received).toHaveLength(0);
    });
});

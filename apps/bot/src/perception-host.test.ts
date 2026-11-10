import {
    CHUNK_SNAPSHOT_EVENT,
    type Envelope,
    EventStream,
    LANDMARK_CANDIDATE_EVENT,
    type LoggerPort,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';
import {
    DetectorPipeline,
    type LoadedChunkSnapshot,
    PathDetector,
    PerceptionRateLimiter,
    RingSampler,
    type VoxelPosition,
} from '@ticrafter/perception';
import { describe, expect, it } from 'bun:test';

import { PerceptionHost } from './perception-host.js';
import type { PerceptionSource } from './perception-source.js';

class FakeSource implements PerceptionSource {
    position(): VoxelPosition {
        return { x: 8, y: 64, z: 8 };
    }

    nextLoadedChunk(): LoadedChunkSnapshot {
        return {
            chunk: { x: 0, z: 0 },
            version: 1,
            observedAt: '2026-11-10T12:00:00.000Z',
            blocks: Array.from({ length: 10 }, (_, index) => ({
                position: { x: index, y: 64, z: 0 },
                blockId: 'stone',
                solid: true,
            })),
        };
    }
}

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

describe('PerceptionHost', () => {
    it('publishes chunk snapshots and landmark candidates', () => {
        const [limiter, limiterError] = PerceptionRateLimiter.create(
            { tokensPerSecond: 1, burst: 1 },
            () => 0,
        );
        expect(limiterError).toBeNull();
        if (limiter === null) return;
        const [sampler, samplerError] = RingSampler.create({ ringRadius: 32 }, limiter);
        expect(samplerError).toBeNull();
        if (sampler === null) return;

        const received: Envelope[] = [];
        const events = new EventStream();
        const host = new PerceptionHost({
            botId: 'bot.tibot1',
            source: new FakeSource(),
            sampler,
            events,
            sink: (envelope): Result<void, TransportFailure> => {
                received.push(envelope);
                return [undefined, null];
            },
            logger,
            ringRadius: 32,
            intervalMilliseconds: 60_000,
            pipeline: new DetectorPipeline([new PathDetector()]),
        });
        host.start();
        const [candidates, tickError] = host.tick();
        host.stop();

        expect(tickError).toBeNull();
        expect(candidates?.map((candidate) => candidate.type)).toEqual(['path']);
        expect(received.map((envelope) => envelope.type)).toEqual([
            CHUNK_SNAPSHOT_EVENT,
            LANDMARK_CANDIDATE_EVENT,
        ]);
    });
});

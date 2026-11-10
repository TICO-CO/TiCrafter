import { describe, expect, it } from 'bun:test';

import { PerceptionRateLimiter } from './perception-rate-limiter.js';
import { type LoadedChunkSnapshot, RingSampler } from './ring-sampler.js';

class MutableClock {
    constructor(public milliseconds = 0) {}

    read(): number {
        return this.milliseconds;
    }
}

function loadedChunk(x: number, z: number, version = 1): LoadedChunkSnapshot {
    return {
        chunk: { x, z },
        version,
        observedAt: '2026-11-10T12:00:00.000Z',
        blocks: [{ position: { x: x * 16, y: 64, z: z * 16 }, blockId: 'stone', solid: true }],
    };
}

function rateLimiter(burst: number): PerceptionRateLimiter | null {
    const clock = new MutableClock();
    const [limiter, error] = PerceptionRateLimiter.create({ tokensPerSecond: 1, burst }, () =>
        clock.read(),
    );
    expect(error).toBeNull();
    return limiter;
}

describe('RingSampler', () => {
    it('samples chunks inside the ring ordered by distance', () => {
        const limiter = rateLimiter(5);
        if (limiter === null) return;
        const [sampler, createError] = RingSampler.create({ ringRadius: 16 }, limiter);
        expect(createError).toBeNull();
        if (sampler === null) return;

        const [sampled, error] = sampler.sample({
            botId: 'bot.tibot1',
            position: { x: 8, y: 64, z: 8 },
            loadedChunks: [loadedChunk(2, 0), loadedChunk(0, 0), loadedChunk(1, 0)],
        });

        expect(error).toBeNull();
        expect(sampled?.map((snapshot) => snapshot.chunk)).toEqual([
            { x: 0, z: 0 },
            { x: 1, z: 0 },
        ]);
    });

    it('respects the per-bot rate budget', () => {
        const limiter = rateLimiter(2);
        if (limiter === null) return;
        const [sampler, createError] = RingSampler.create({ ringRadius: 64 }, limiter);
        expect(createError).toBeNull();
        if (sampler === null) return;

        const [sampled, error] = sampler.sample({
            botId: 'bot.tibot1',
            position: { x: 8, y: 64, z: 8 },
            loadedChunks: [loadedChunk(0, 0), loadedChunk(1, 0), loadedChunk(2, 0)],
        });

        expect(error).toBeNull();
        expect(sampled).toHaveLength(2);
    });

    it('rejects a ring radius outside the supported range', () => {
        const limiter = rateLimiter(1);
        if (limiter === null) return;
        const [sampler, error] = RingSampler.create({ ringRadius: 15 }, limiter);

        expect(sampler).toBeNull();
        expect(error).toEqual({ type: 'INVALID_RING_RADIUS', value: 15 });
    });

    it('rejects invalid bot positions', () => {
        const limiter = rateLimiter(1);
        if (limiter === null) return;
        const [sampler, createError] = RingSampler.create({ ringRadius: 16 }, limiter);
        expect(createError).toBeNull();
        if (sampler === null) return;

        const [sampled, error] = sampler.sample({
            botId: 'bot.tibot1',
            position: { x: 1.5, y: 64, z: 8 },
            loadedChunks: [loadedChunk(0, 0)],
        });

        expect(sampled).toBeNull();
        expect(error).toEqual({
            type: 'INVALID_BLOCK_POSITION',
            position: { x: 1.5, y: 64, z: 8 },
        });
    });

    it('preserves chunk metadata on sampled snapshots', () => {
        const limiter = rateLimiter(1);
        if (limiter === null) return;
        const [sampler, createError] = RingSampler.create({ ringRadius: 64 }, limiter);
        expect(createError).toBeNull();
        if (sampler === null) return;

        const [sampled, error] = sampler.sample({
            botId: 'bot.tibot1',
            position: { x: 8, y: 64, z: 8 },
            loadedChunks: [loadedChunk(0, 0, 7)],
        });

        expect(error).toBeNull();
        expect(sampled?.[0]?.botId).toBe('bot.tibot1');
        expect(sampled?.[0]?.version).toBe(7);
        expect(sampled?.[0]?.blocks).toHaveLength(1);
    });
});

import { describe, expect, it } from 'bun:test';

import { PerceptionRateLimiter } from './perception-rate-limiter.js';

class MutableClock {
    constructor(public milliseconds = 0) {}

    read(): number {
        return this.milliseconds;
    }

    advance(deltaMilliseconds: number): void {
        this.milliseconds += deltaMilliseconds;
    }
}

describe('PerceptionRateLimiter', () => {
    it('enforces the burst budget', () => {
        const clock = new MutableClock();
        const [limiter, createError] = PerceptionRateLimiter.create(
            { tokensPerSecond: 1, burst: 2 },
            () => clock.read(),
        );
        expect(createError).toBeNull();
        if (limiter === null) return;

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.tryAcquire('bot.tibot1')).toBe(false);
    });

    it('refills tokens over time', () => {
        const clock = new MutableClock();
        const [limiter, createError] = PerceptionRateLimiter.create(
            { tokensPerSecond: 1, burst: 2 },
            () => clock.read(),
        );
        expect(createError).toBeNull();
        if (limiter === null) return;

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        clock.advance(1000);

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
    });

    it('tracks bots independently and caps the bucket', () => {
        const clock = new MutableClock();
        const [limiter, createError] = PerceptionRateLimiter.create(
            { tokensPerSecond: 1, burst: 2 },
            () => clock.read(),
        );
        expect(createError).toBeNull();
        if (limiter === null) return;

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.remaining('bot.tibot1')).toBe(1);
        expect(limiter.remaining('bot.tibot2')).toBe(2);

        clock.advance(10_000);
        expect(limiter.remaining('bot.tibot1')).toBe(2);
    });

    it('rejects invalid rate limit options', () => {
        const clock = new MutableClock();
        const [limiter, createError] = PerceptionRateLimiter.create(
            { tokensPerSecond: -1, burst: 0 },
            () => clock.read(),
        );

        expect(limiter).toBeNull();
        expect(createError).toEqual({
            type: 'INVALID_RATE_LIMIT_OPTIONS',
            tokensPerSecond: -1,
            burst: 0,
        });
    });

    it('rejects non-positive resource costs without changing the bucket', () => {
        const clock = new MutableClock();
        const [limiter, createError] = PerceptionRateLimiter.create(
            { tokensPerSecond: 1, burst: 2 },
            () => clock.read(),
        );
        expect(createError).toBeNull();
        if (limiter === null) return;

        expect(limiter.tryAcquire('bot.tibot1', 0)).toBe(false);
        expect(limiter.tryAcquire('bot.tibot1', -5)).toBe(false);
        expect(limiter.remaining('bot.tibot1')).toBe(2);
    });
});

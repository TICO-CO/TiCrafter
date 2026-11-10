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
        const limiter = new PerceptionRateLimiter({ tokensPerSecond: 1, burst: 2 }, () =>
            clock.read(),
        );

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.tryAcquire('bot.tibot1')).toBe(false);
    });

    it('refills tokens over time', () => {
        const clock = new MutableClock();
        const limiter = new PerceptionRateLimiter({ tokensPerSecond: 1, burst: 2 }, () =>
            clock.read(),
        );

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        clock.advance(1000);

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
    });

    it('tracks bots independently and caps the bucket', () => {
        const clock = new MutableClock();
        const limiter = new PerceptionRateLimiter({ tokensPerSecond: 1, burst: 2 }, () =>
            clock.read(),
        );

        expect(limiter.tryAcquire('bot.tibot1')).toBe(true);
        expect(limiter.remaining('bot.tibot1')).toBe(1);
        expect(limiter.remaining('bot.tibot2')).toBe(2);

        clock.advance(10_000);
        expect(limiter.remaining('bot.tibot1')).toBe(2);
    });
});

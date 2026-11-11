import type { Result } from '@ticrafter/core';

import { PerceptionFailures } from './failures.js';
import type { PerceptionFailure } from './types.js';

export interface PerceptionRateLimitOptions {
    tokensPerSecond: number;
    burst: number;
}

interface TokenBucket {
    tokens: number;
    updatedAtMilliseconds: number;
}

export class PerceptionRateLimiter {
    private readonly buckets = new Map<string, TokenBucket>();

    static create(
        options: PerceptionRateLimitOptions,
        clock: () => number,
    ): Result<PerceptionRateLimiter, PerceptionFailure> {
        const valid =
            Number.isFinite(options.tokensPerSecond) &&
            options.tokensPerSecond >= 0 &&
            Number.isFinite(options.burst) &&
            options.burst > 0;
        if (!valid) {
            return [
                null,
                PerceptionFailures.invalidRateLimitOptions(options.tokensPerSecond, options.burst),
            ];
        }
        return [new PerceptionRateLimiter(options, clock), null];
    }

    private constructor(
        private readonly options: PerceptionRateLimitOptions,
        private readonly clock: () => number,
    ) {}

    tryAcquire(botId: string, cost = 1): boolean {
        if (!Number.isFinite(cost) || cost <= 0) return false;
        const bucket = this.refill(botId, this.clock());
        if (bucket.tokens < cost) return false;
        bucket.tokens -= cost;
        return true;
    }

    remaining(botId: string): number {
        return this.refill(botId, this.clock()).tokens;
    }

    private refill(botId: string, now: number): TokenBucket {
        const bucket = this.bucketFor(botId);
        const elapsedSeconds = Math.max(0, now - bucket.updatedAtMilliseconds) / 1000;
        bucket.tokens = Math.min(
            this.options.burst,
            bucket.tokens + elapsedSeconds * this.options.tokensPerSecond,
        );
        bucket.updatedAtMilliseconds = now;
        return bucket;
    }

    private bucketFor(botId: string): TokenBucket {
        const existing = this.buckets.get(botId);
        if (existing) return existing;
        const created: TokenBucket = {
            tokens: this.options.burst,
            updatedAtMilliseconds: this.clock(),
        };
        this.buckets.set(botId, created);
        return created;
    }
}

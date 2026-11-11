import type { Result, Vec3 } from '@ticrafter/core';

export type ReachRateFailure =
    | { type: 'REACH_EXCEEDED'; distance: number; maximumReach: number }
    | { type: 'RATE_LIMITED'; waitMilliseconds: number };

export interface ReachRateGuardOptions {
    maximumReach: number;
    actionsPerSecond: number;
    clock?: () => number;
}

export class ReachRateGuard {
    private readonly clock: () => number;
    private readonly minimumIntervalMilliseconds: number;
    private lastActionAt = Number.NEGATIVE_INFINITY;

    constructor(private readonly options: ReachRateGuardOptions) {
        this.clock = options.clock ?? Date.now;
        this.minimumIntervalMilliseconds = 1000 / options.actionsPerSecond;
    }

    evaluate(botPosition: Vec3, target: Vec3 | null): Result<void, ReachRateFailure> {
        if (target !== null) {
            const distance = ReachRateGuard.distance(botPosition, target);
            if (distance > this.options.maximumReach) {
                return [
                    null,
                    {
                        type: 'REACH_EXCEEDED',
                        distance,
                        maximumReach: this.options.maximumReach,
                    },
                ];
            }
        }
        const now = this.clock();
        const elapsed = now - this.lastActionAt;
        if (elapsed < this.minimumIntervalMilliseconds) {
            return [
                null,
                {
                    type: 'RATE_LIMITED',
                    waitMilliseconds: Math.ceil(this.minimumIntervalMilliseconds - elapsed),
                },
            ];
        }
        this.lastActionAt = now;
        return [undefined, null];
    }

    static describe(failure: ReachRateFailure): string {
        switch (failure.type) {
            case 'REACH_EXCEEDED':
                return `target ${failure.distance.toFixed(2)} blocks away exceeds reach ${failure.maximumReach}`;
            case 'RATE_LIMITED':
                return `action rate limited for ${failure.waitMilliseconds}ms`;
        }
    }

    private static distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}

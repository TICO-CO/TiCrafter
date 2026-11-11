import type { Result } from '@ticrafter/core';

import type { DecisionFailure } from './types.js';

const WINDOW_MILLISECONDS = 1000;

export class DecisionRateLimiter {
    private readonly fleet: number[] = [];
    private readonly bots = new Map<string, number[]>();

    constructor(
        private readonly fleetRatePerSecond: number,
        private readonly botRatePerSecond: number,
    ) {}

    allow(botId: string, now: number): Result<void, DecisionFailure> {
        this.prune(this.fleet, now);
        const botRequests = this.bots.get(botId) ?? [];
        this.prune(botRequests, now);
        if (this.fleet.length >= this.fleetRatePerSecond) {
            return [null, { type: 'RATE_LIMITED', botId }];
        }
        if (botRequests.length >= this.botRatePerSecond) {
            return [null, { type: 'RATE_LIMITED', botId }];
        }
        this.fleet.push(now);
        botRequests.push(now);
        this.bots.set(botId, botRequests);
        return [undefined, null];
    }

    private prune(requests: number[], now: number): void {
        while (requests.length > 0 && now - (requests[0] ?? 0) >= WINDOW_MILLISECONDS) {
            requests.shift();
        }
    }
}

import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import type { PlannerUsage } from './types.js';

const minuteMilliseconds = 60_000;

export interface PlannerBudgetOptions {
    callsPerMinute: number;
    maxTokensPerCall: number;
}

export interface PlannerCallPermit {
    inputTokens: number;
    reservedTokens: number;
    startedAt: number;
    settled: boolean;
}

export class PlannerBudgetLimiter {
    private readonly calls: number[] = [];
    private reservedTokens = 0;

    constructor(
        private readonly options: PlannerBudgetOptions,
        private readonly now: () => number = Date.now,
    ) {}

    reserve(inputTokens: number): Result<PlannerCallPermit, PlannerFailure> {
        if (!Number.isFinite(inputTokens) || inputTokens < 0) {
            return [
                null,
                {
                    type: 'BUDGET',
                    reason: 'TOKENS_PER_CALL',
                    message: 'input token estimate is invalid',
                },
            ];
        }
        if (inputTokens > this.options.maxTokensPerCall) {
            return [
                null,
                {
                    type: 'BUDGET',
                    reason: 'TOKENS_PER_CALL',
                    message: `input token estimate ${inputTokens} exceeds cap ${this.options.maxTokensPerCall}`,
                },
            ];
        }
        const currentTime = this.now();
        this.pruneCalls(currentTime);
        if (this.calls.length >= this.options.callsPerMinute) {
            return [
                null,
                {
                    type: 'BUDGET',
                    reason: 'CALLS_PER_MINUTE',
                    message: `calls per minute cap ${this.options.callsPerMinute} reached`,
                },
            ];
        }
        const reserved = inputTokens;
        if (this.reservedTokens + reserved > this.options.maxTokensPerCall) {
            return [
                null,
                {
                    type: 'BUDGET',
                    reason: 'TOKENS_PER_CALL',
                    message: 'concurrent token reservation exceeds call cap',
                },
            ];
        }
        this.calls.push(currentTime);
        this.reservedTokens += reserved;
        return [
            {
                inputTokens,
                reservedTokens: reserved,
                startedAt: currentTime,
                settled: false,
            },
            null,
        ];
    }

    settle(permit: PlannerCallPermit, usage: PlannerUsage): void {
        if (permit.settled) return;
        permit.settled = true;
        this.reservedTokens = Math.max(0, this.reservedTokens - permit.reservedTokens);
    }

    release(permit: PlannerCallPermit): void {
        this.settle(permit, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    }

    private pruneCalls(currentTime: number): void {
        while (this.calls.length > 0) {
            const oldest = this.calls[0];
            if (oldest === undefined || currentTime - oldest < minuteMilliseconds) return;
            this.calls.shift();
        }
    }
}

import { describe, expect, it } from 'bun:test';

import { PlannerBudgetLimiter } from './budget-limiter.js';

describe('PlannerBudgetLimiter', () => {
    it('enforces calls per minute', () => {
        let now = 1_000;
        const limiter = new PlannerBudgetLimiter(
            { callsPerMinute: 1, maxTokensPerCall: 100 },
            () => now,
        );
        const [first, firstError] = limiter.reserve(10);
        expect(firstError).toBeNull();
        expect(first).not.toBeNull();
        if (first !== null)
            limiter.settle(first, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
        const [second, secondError] = limiter.reserve(10);
        expect(second).toBeNull();
        expect(secondError?.type).toBe('BUDGET');
        now += 60_001;
        const [third, thirdError] = limiter.reserve(10);
        expect(thirdError).toBeNull();
        expect(third).not.toBeNull();
    });

    it('enforces per-call token caps', () => {
        const limiter = new PlannerBudgetLimiter({ callsPerMinute: 4, maxTokensPerCall: 100 });
        const [permit, permitError] = limiter.reserve(101);
        expect(permit).toBeNull();
        expect(permitError?.type).toBe('BUDGET');
    });

    it('releases reservations after failures', () => {
        const limiter = new PlannerBudgetLimiter({ callsPerMinute: 4, maxTokensPerCall: 100 });
        const [permit, permitError] = limiter.reserve(100);
        expect(permitError).toBeNull();
        if (permit === null) return;
        limiter.release(permit);
        const [next, nextError] = limiter.reserve(100);
        expect(nextError).toBeNull();
        expect(next).not.toBeNull();
    });
});

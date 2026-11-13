import { describe, expect, it } from 'bun:test';

import { GoalDeadlinePolicy } from './deadline-policy.js';

describe('goal deadline policy', () => {
    it('creates per-kind deadlines and allows overrides', () => {
        const eat = GoalDeadlinePolicy.deadlineFor('eat', '2026-11-13T00:00:00.000Z');
        const gather = GoalDeadlinePolicy.deadlineFor('gather', '2026-11-13T00:00:00.000Z');
        const custom = GoalDeadlinePolicy.deadlineFor('gather', '2026-11-13T00:00:00.000Z', {
            gather: 1000,
        });
        expect(eat).not.toBeNull();
        expect(gather).not.toBeNull();
        expect(Date.parse(custom ?? '')).toBe(Date.parse('2026-11-13T00:00:01.000Z'));
        expect(Date.parse(gather ?? '') > Date.parse(eat ?? '')).toBe(true);
    });

    it('extends a deadline and detects expiry', () => {
        const deadline = '2026-11-13T00:00:00.000Z';
        const extended = GoalDeadlinePolicy.extend(deadline, 'eat');
        expect(extended).not.toBeNull();
        expect(GoalDeadlinePolicy.expired(deadline, '2026-11-13T00:00:00.001Z')).toBe(true);
        expect(GoalDeadlinePolicy.expired(extended, '2026-11-13T00:00:00.001Z')).toBe(false);
        expect(GoalDeadlinePolicy.expired(null, '2026-11-13T00:00:00.001Z')).toBe(false);
    });
});

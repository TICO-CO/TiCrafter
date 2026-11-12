import { describe, expect, it } from 'bun:test';

import { JobMarketPolicy } from './job-market-policy.js';
import { NeedsModel } from './needs-model.js';
import { PersonalityModel } from './personality-model.js';

const context = (overrides: { activeGoal?: boolean; role?: string | null } = {}) => ({
    role: overrides.role ?? 'miner',
    activeGoal: overrides.activeGoal ?? false,
    needs: NeedsModel.create()[0] as NeedsModel,
    traits: PersonalityModel.fromBotIndex(0),
});

const offer = (overrides: Partial<Parameters<typeof JobMarketPolicy.decide>[0]> = {}) => ({
    taskId: 'task-1',
    title: 'Mine stone',
    priority: 60,
    skillId: 'mine',
    requiredRole: 'miner',
    distance: 12,
    ...overrides,
});

describe('JobMarketPolicy', () => {
    it('accepts a nearby role-matched job that matches needs', () => {
        const choice = JobMarketPolicy.decide(offer(), context());
        expect(choice.decision).toBe('accept');
        expect(choice.reason.length > 0).toBe(true);
    });

    it('declines jobs that require another role', () => {
        const choice = JobMarketPolicy.decide(offer({ requiredRole: 'farmer' }), context());
        expect(choice.decision).toBe('decline');
        expect(choice.reason.includes('role')).toBe(true);
    });

    it('defers while an agency goal is active', () => {
        const choice = JobMarketPolicy.decide(offer(), context({ activeGoal: true }));
        expect(choice.decision).toBe('defer');
        expect(choice.reason.includes('agency goal')).toBe(true);
    });

    it('declines distant low-value work', () => {
        const choice = JobMarketPolicy.decide(
            offer({ priority: 1, distance: 200, requiredRole: null, skillId: null }),
            context(),
        );
        expect(choice.decision).toBe('decline');
    });
});

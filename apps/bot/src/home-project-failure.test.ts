import type { SkillProgressEvent } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { HomeProjectFailure } from './home-project-failure.js';

function progress(overrides: Partial<SkillProgressEvent> = {}): SkillProgressEvent {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-13T00:00:00.000Z',
        skillId: 'navigate',
        taskId: 'goal:prepare-night:prepare-for-nightfall',
        status: 'failed',
        progress: { done: 0, total: 1, label: 'moving' },
        failureClass: 'no-path',
        ...overrides,
    };
}

describe('home project failure', () => {
    for (const failureClass of ['no-path', 'target-missing', 'timeout']) {
        it(`abandons the home project on ${failureClass}`, () => {
            expect(HomeProjectFailure.isUnreachableNavigation(progress({ failureClass }))).toBe(
                true,
            );
        });
    }

    for (const failureClass of ['preempted', 'cancelled', 'execution-failed', 'missing-item']) {
        it(`keeps the home project on ${failureClass}`, () => {
            expect(HomeProjectFailure.isUnreachableNavigation(progress({ failureClass }))).toBe(
                false,
            );
        });
    }

    for (const taskId of [
        'goal:shelter:return-to-shelter',
        'goal:return-home:return-home',
        'goal:prepare-night:prepare-for-nightfall',
    ]) {
        it(`tracks home-bound goal ${taskId}`, () => {
            expect(HomeProjectFailure.isUnreachableNavigation(progress({ taskId }))).toBe(true);
        });
    }

    it('ignores other skills, goals, and statuses', () => {
        expect(
            HomeProjectFailure.isUnreachableNavigation(progress({ skillId: 'gather-wool' })),
        ).toBe(false);
        expect(
            HomeProjectFailure.isUnreachableNavigation(progress({ taskId: 'seed-collect-1' })),
        ).toBe(false);
        expect(HomeProjectFailure.isUnreachableNavigation(progress({ status: 'running' }))).toBe(
            false,
        );
        expect(HomeProjectFailure.isUnreachableNavigation(progress({ taskId: undefined }))).toBe(
            false,
        );
    });
});

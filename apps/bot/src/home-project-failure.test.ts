import type { SkillProgressEvent } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { HomeProjectFailure, HomeProjectRecovery } from './home-project-failure.js';

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
    for (const failureClass of ['no-path', 'target-missing']) {
        it(`abandons the home project on ${failureClass}`, () => {
            expect(HomeProjectFailure.isUnreachableNavigation(progress({ failureClass }))).toBe(
                true,
            );
        });
    }

    for (const failureClass of [
        'preempted',
        'cancelled',
        'execution-failed',
        'missing-item',
        'timeout',
    ]) {
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

describe('home project recovery', () => {
    function recovery(accepted: boolean) {
        const calls = { abandon: 0, clear: 0, repropose: 0 };
        let now = 0;
        const controller = new HomeProjectRecovery({
            abandon: async () => {
                calls.abandon += 1;
                return accepted;
            },
            clearHome: () => {
                calls.clear += 1;
            },
            repropose: async () => {
                calls.repropose += 1;
            },
            now: () => now,
            retryMilliseconds: 1_000,
        });
        return {
            controller,
            calls,
            advance: (milliseconds: number) => {
                now += milliseconds;
            },
        };
    }

    it('clears home and reproposes only after an accepted abandon', async () => {
        const { controller, calls } = recovery(true);

        expect(await controller.abandon('project-1', 'no-path')).toBe(true);
        expect(calls).toEqual({ abandon: 1, clear: 1, repropose: 1 });
        expect(controller.canAttempt()).toBe(true);
    });

    it('keeps home focus and delays retries after a rejected abandon', async () => {
        const { controller, calls, advance } = recovery(false);

        expect(await controller.abandon('project-1', 'no-path')).toBe(false);
        expect(calls).toEqual({ abandon: 1, clear: 0, repropose: 0 });
        expect(controller.canAttempt()).toBe(false);

        advance(1_000);
        expect(controller.canAttempt()).toBe(true);
    });

    it('rejects concurrent attempts until the request finishes', async () => {
        const pending: { resolve: ((accepted: boolean) => void) | null } = { resolve: null };
        let abandonCalls = 0;
        const controller = new HomeProjectRecovery({
            abandon: async () => {
                abandonCalls += 1;
                return new Promise<boolean>((resolve) => {
                    pending.resolve = resolve;
                });
            },
            clearHome: () => undefined,
            repropose: async () => undefined,
            now: () => 0,
        });

        const first = controller.abandon('project-1', 'no-path');
        expect(controller.busy).toBe(true);
        expect(await controller.abandon('project-1', 'no-path')).toBe(false);
        expect(abandonCalls).toBe(1);

        pending.resolve?.(true);
        expect(await first).toBe(true);
        expect(controller.busy).toBe(false);
    });

    it('treats a failed abandon request as a retryable rejection', async () => {
        let cleared = 0;
        const controller = new HomeProjectRecovery({
            abandon: () => Promise.reject(new Error('transport down')),
            clearHome: () => {
                cleared += 1;
            },
            repropose: async () => undefined,
            now: () => 0,
        });

        expect(await controller.abandon('project-1', 'no-path')).toBe(false);
        expect(cleared).toBe(0);
        expect(controller.busy).toBe(false);
        expect(controller.canAttempt()).toBe(false);
    });

    it('resets retry state when the project is closed externally', async () => {
        const { controller, advance } = recovery(false);

        expect(await controller.abandon('project-1', 'no-path')).toBe(false);
        expect(controller.canAttempt()).toBe(false);

        advance(500);
        controller.reset();
        expect(controller.canAttempt()).toBe(true);
    });
});

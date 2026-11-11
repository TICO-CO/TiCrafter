import type {
    ActionDispatchPort,
    ActionFailureClass,
    ActionOutcome,
    ActionRequest,
    Result,
    Vec3,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { EffectsEmitter } from './effects-emitter.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { SkillRegistry } from './registry.js';
import { SleepSkill } from './sleep.js';
import type { Skill, SkillContext, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    constructor(private readonly bed: Vec3 | null = null) {}

    blockAt(): string | null {
        return 'stone';
    }

    nearestContainer(): Vec3 | null {
        return null;
    }

    nearestBlock(): Vec3 | null {
        return this.bed;
    }
}

class FakeDispatch implements ActionDispatchPort {
    lastHandle: string | null = null;
    lastRequest: ActionRequest | null = null;
    outcome: ActionOutcome | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        this.lastHandle = 'handle-1';
        this.lastRequest = request;
        this.outcome = null;
        return [this.lastHandle, null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        if (handleId !== this.lastHandle) return [null, 'unknown handle'];
        return [this.outcome, null];
    }

    cancel(): Result<void, string> {
        return [undefined, null];
    }

    complete(): void {
        if (this.lastRequest === null) return;
        this.outcome = { request: this.lastRequest, status: 'completed' };
    }

    fail(failureClass: ActionFailureClass, message: string): void {
        if (this.lastRequest === null) return;
        this.outcome = {
            request: this.lastRequest,
            status: 'failed',
            message,
            failure: { class: failureClass, message },
        };
    }
}

function context(overrides: Partial<SkillContext> = {}): SkillContext {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-10T22:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 13_000,
        inventory: [],
        world: new FakeWorld({ x: 0, y: 64, z: 3 }),
        nearestHostile: null,
        lastAction: null,
        ...overrides,
    };
}

function lifecycleFor(skill: Skill): {
    dispatch: FakeDispatch;
    lifecycle: SkillLifecycleExecutor;
} {
    const dispatch = new FakeDispatch();
    const registry = new SkillRegistry();
    const [, registerError] = registry.register(skill);
    expect(registerError).toBeNull();
    return {
        dispatch,
        lifecycle: new SkillLifecycleExecutor({
            registry,
            dispatch,
            effects: new EffectsEmitter(),
        }),
    };
}

describe('sleep skill', () => {
    it('moves to the bed, uses it, waits, and confirms sleep', () => {
        const skill = new SleepSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context();
        const [started, startError] = lifecycle.start('sleep', {}, state);
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({ kind: 'move-to', position: { x: 0, y: 64, z: 3 } });

        dispatch.complete();
        const [using] = lifecycle.advance(state);
        expect(using?.action?.kind).toBe('use-block');

        dispatch.complete();
        const [waiting] = lifecycle.advance(state);
        expect(waiting?.action?.kind).toBe('wait');

        dispatch.complete();
        const [completed] = lifecycle.advance(context({ isSleeping: true }));
        expect(completed?.status).toBe('completed');
    });

    it('rejects daytime and unsafe hostiles in canRun', () => {
        const skill = new SleepSkill();
        const daytime = skill.canRun(context({ timeOfDay: 6_000 }), {});
        expect(daytime).toEqual([false, null]);
        const unsafe = skill.canRun(
            context({
                nearestHostile: {
                    name: 'zombie',
                    position: { x: 1, y: 64, z: 0 },
                    distance: 4,
                },
            }),
            {},
        );
        expect(unsafe).toEqual([false, null]);
    });

    it('fails closed when no bed exists', () => {
        const skill = new SleepSkill();
        const [canRun, canRunError] = skill.canRun(context({ world: new FakeWorld(null) }), {});
        expect(canRun).toBeNull();
        expect(canRunError).toBe('sleep requires a bed');
    });

    it('maps a no-path action failure', () => {
        const skill = new SleepSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context();
        lifecycle.start('sleep', {}, state);
        dispatch.fail('no-path', 'bed unreachable');
        const [failed] = lifecycle.advance(state);
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('no-path');
    });

    it('checkpoints and restores the bed approach', () => {
        const skill = new SleepSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context();
        const [started] = lifecycle.start('sleep', {}, state);
        if (started === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(state, started.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.bed).toEqual({ x: 0, y: 64, z: 3 });
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restoreError).toBeNull();
        if (restored === null) return;
        dispatch.complete();
        const [resumed, resumeError] = skill.step(
            { ...state, lastAction: dispatch.outcome },
            restored,
        );
        expect(resumeError).toBeNull();
        expect(resumed?.action?.kind).toBe('use-block');
    });
});

import type {
    ActionDispatchPort,
    ActionFailureClass,
    ActionOutcome,
    ActionRequest,
    Result,
    Vec3,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { BridgeSkill } from './bridge.js';
import { EffectsEmitter } from './effects-emitter.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { SkillRegistry } from './registry.js';
import type { Skill, SkillContext, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    constructor(
        private readonly blocks: ReadonlyMap<string, string>,
        private readonly fallback: string = 'air',
    ) {}

    blockAt(position: Vec3): string | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? this.fallback;
    }

    nearestContainer(): Vec3 | null {
        return null;
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
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 65, z: -1 },
        health: 20,
        food: 20,
        inventory: [{ name: 'oak_planks', count: 4 }],
        world: new FakeWorld(new Map()),
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

const supportedWorld = new FakeWorld(
    new Map([
        ['0,63,0', 'stone'],
        ['0,63,1', 'stone'],
        ['0,63,2', 'stone'],
    ]),
);

const bridgeInput = {
    target: { x: 0, y: 64, z: 0 },
    end: { x: 0, y: 64, z: 2 },
    material: 'oak_planks',
};

describe('bridge skill', () => {
    it('places every supported deck position', () => {
        const skill = new BridgeSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({ world: supportedWorld });
        const [started, startError] = lifecycle.start('bridge', bridgeInput, state);
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 0, y: 64, z: 0 },
            reference: { x: 0, y: 63, z: 0 },
            face: { x: 0, y: 1, z: 0 },
        });

        dispatch.complete();
        const [second] = lifecycle.advance(state);
        expect(second?.action).toMatchObject({ position: { x: 0, y: 64, z: 1 } });

        dispatch.complete();
        const [third] = lifecycle.advance(state);
        expect(third?.action).toMatchObject({ position: { x: 0, y: 64, z: 2 } });

        dispatch.complete();
        const [completed] = lifecycle.advance(state);
        expect(completed?.status).toBe('completed');
    });

    it('skips deck positions that are already material', () => {
        const skill = new BridgeSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            world: new FakeWorld(
                new Map([
                    ['0,64,0', 'oak_planks'],
                    ['0,63,1', 'stone'],
                    ['0,63,2', 'stone'],
                ]),
            ),
        });
        const [started] = lifecycle.start('bridge', bridgeInput, state);
        expect(started?.action).toMatchObject({ position: { x: 0, y: 64, z: 1 } });
        dispatch.complete();
        lifecycle.advance(state);
        dispatch.complete();
        const [completed] = lifecycle.advance(state);
        expect(completed?.status).toBe('completed');
    });

    it('fails when a deck position has no support below', () => {
        const skill = new BridgeSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const world = new FakeWorld(new Map([['0,63,0', 'stone']]));
        const state = context({ world });
        lifecycle.start('bridge', { ...bridgeInput, end: { x: 0, y: 64, z: 1 } }, state);
        dispatch.complete();
        const [failed] = lifecycle.advance(state);
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('unsupported');
    });

    it('preflights the bridge material', () => {
        const skill = new BridgeSkill();
        const { lifecycle } = lifecycleFor(skill);
        const [step, startError] = lifecycle.start(
            'bridge',
            bridgeInput,
            context({ world: supportedWorld, inventory: [] }),
        );
        expect(startError).toBeNull();
        expect(step?.status).toBe('failed');
        expect(step?.failure?.class).toBe('missing-item');
    });

    it('fails closed without an end or direction', () => {
        const skill = new BridgeSkill();
        const [canRun, canRunError] = skill.canRun(context(), {
            target: { x: 0, y: 64, z: 0 },
            material: 'oak_planks',
        });
        expect(canRun).toBeNull();
        expect(canRunError).toBe('bridge requires an end or direction with maxLength');
    });

    it('checkpoints cursor and placed keys', () => {
        const skill = new BridgeSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({ world: supportedWorld });
        const [started] = lifecycle.start('bridge', bridgeInput, state);
        if (started === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(state, started.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.cursor).toBe(0);
        expect(checkpoint?.state.placed).toEqual([]);
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
        expect(resumed?.action).toMatchObject({ position: { x: 0, y: 64, z: 1 } });
        expect(resumed?.run.state.placed).toEqual(['0,64,0']);
    });
});

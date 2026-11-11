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
import { SmeltSkill } from './smelt.js';
import type { Skill, SkillContext, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return 'air';
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
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [],
        world: new FakeWorld(),
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

const furnace = { x: 0, y: 64, z: 1 };
const smeltInput = {
    furnace,
    itemName: 'raw_iron',
    fuelItem: 'coal',
    outputItem: 'iron_ingot',
    count: 2,
};

describe('smelt skill', () => {
    it('runs repeated fuel, input, wait, and withdraw cycles', () => {
        const skill = new SmeltSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            inventory: [
                { name: 'raw_iron', count: 2 },
                { name: 'coal', count: 2 },
            ],
        });
        const [started, startError] = lifecycle.start('smelt', smeltInput, state);
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({ kind: 'transfer', slot: 'fuel' });

        dispatch.complete();
        const [loading] = lifecycle.advance(state);
        expect(loading?.action).toMatchObject({ kind: 'transfer', slot: 'input' });

        dispatch.complete();
        const [waiting] = lifecycle.advance(state);
        expect(waiting?.action?.kind).toBe('wait');

        dispatch.complete();
        const [withdrawing] = lifecycle.advance(state);
        expect(withdrawing?.action).toMatchObject({ kind: 'transfer', slot: 'output' });

        const firstOutput = context({
            inventory: [
                { name: 'raw_iron', count: 1 },
                { name: 'coal', count: 1 },
                { name: 'iron_ingot', count: 1 },
            ],
        });
        dispatch.complete();
        const [secondCycle] = lifecycle.advance(firstOutput);
        expect(secondCycle?.action).toMatchObject({ kind: 'transfer', slot: 'fuel' });

        dispatch.complete();
        lifecycle.advance(firstOutput);
        dispatch.complete();
        lifecycle.advance(firstOutput);
        dispatch.complete();
        lifecycle.advance(firstOutput);

        const finished = context({
            inventory: [
                { name: 'raw_iron', count: 0 },
                { name: 'coal', count: 0 },
                { name: 'iron_ingot', count: 2 },
            ],
        });
        dispatch.complete();
        const [completed] = lifecycle.advance(finished);
        expect(completed?.status).toBe('completed');
    });

    it('fails with missing-item when fuel is absent', () => {
        const skill = new SmeltSkill();
        const { lifecycle } = lifecycleFor(skill);
        const state = context({ inventory: [{ name: 'raw_iron', count: 1 }] });
        const [step, startError] = lifecycle.start('smelt', smeltInput, state);
        expect(startError).toBeNull();
        expect(step?.status).toBe('failed');
        expect(step?.failure?.class).toBe('missing-item');
    });

    it('maps a no-path action failure', () => {
        const skill = new SmeltSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            inventory: [
                { name: 'raw_iron', count: 1 },
                { name: 'coal', count: 1 },
            ],
        });
        lifecycle.start('smelt', { ...smeltInput, count: 1 }, state);
        dispatch.fail('no-path', 'furnace unreachable');
        const [failed] = lifecycle.advance(state);
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('no-path');
    });

    it('checkpoints and restores the furnace cycle', () => {
        const skill = new SmeltSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            inventory: [
                { name: 'raw_iron', count: 1 },
                { name: 'coal', count: 1 },
            ],
        });
        const [started] = lifecycle.start('smelt', { ...smeltInput, count: 1 }, state);
        expect(started?.run.state.phase).toBe('fuel');
        if (started === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(state, started.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.furnace).toEqual(furnace);
        expect(checkpoint?.state.phase).toBe('fuel');
        expect(checkpoint?.state.startedAt).toBe(state.at);
        expect(checkpoint?.state.attempts).toBe(1);
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
        expect(resumed?.action).toMatchObject({ kind: 'transfer', slot: 'input' });
    });
});

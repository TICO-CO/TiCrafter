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
import { ExploreSkill } from './explore.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { SkillRegistry } from './registry.js';
import type { Skill, SkillContext, SkillSpatialPort, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return 'grass_block';
    }

    nearestContainer(): Vec3 | null {
        return null;
    }
}

class FakeSpatial implements SkillSpatialPort {
    constructor(private readonly protectedKeys: ReadonlySet<string>) {}

    isProtected(position: Vec3): Result<boolean, string> {
        return [this.protectedKeys.has(`${position.x},${position.y},${position.z}`), null];
    }

    route(): Result<readonly Vec3[] | null, string> {
        return [null, null];
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

const firstWaypoint = { x: 4, y: 64, z: 0 };
const secondWaypoint = { x: 8, y: 64, z: 0 };

describe('explore skill', () => {
    it('follows provided waypoints to completion', () => {
        const skill = new ExploreSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context();
        const [started, startError] = lifecycle.start(
            'explore',
            { waypoints: [firstWaypoint, secondWaypoint] },
            state,
        );
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({ kind: 'move-to', position: firstWaypoint });

        dispatch.complete();
        const [moving] = lifecycle.advance(state);
        expect(moving?.action).toMatchObject({ kind: 'move-to', position: secondWaypoint });

        dispatch.complete();
        const [completed] = lifecycle.advance(state);
        expect(completed?.status).toBe('completed');
    });

    it('skips protected waypoints', () => {
        const skill = new ExploreSkill();
        const { lifecycle } = lifecycleFor(skill);
        const state = context({
            services: {
                spatial: new FakeSpatial(new Set(['4,64,0'])),
            },
        });
        const [started] = lifecycle.start(
            'explore',
            { waypoints: [firstWaypoint, secondWaypoint] },
            state,
        );
        expect(started?.action).toMatchObject({ kind: 'move-to', position: secondWaypoint });
    });

    it('generates waypoints around a center', () => {
        const skill = new ExploreSkill();
        const { lifecycle } = lifecycleFor(skill);
        const [started, startError] = lifecycle.start(
            'explore',
            { center: { x: 0, y: 64, z: 0 }, radius: 12, maxSteps: 4 },
            context(),
        );
        expect(startError).toBeNull();
        expect(started?.action?.kind).toBe('move-to');
        const waypoints = started?.run.state.waypoints;
        expect(Array.isArray(waypoints) && waypoints.length > 0).toBe(true);
    });

    it('fails closed without waypoints or center', () => {
        const skill = new ExploreSkill();
        const [canRun, canRunError] = skill.canRun(context(), {});
        expect(canRun).toBeNull();
        expect(canRunError).toBe('explore requires waypoints or center');
    });

    it('maps a no-path action failure', () => {
        const skill = new ExploreSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context();
        lifecycle.start('explore', { waypoints: [firstWaypoint] }, state);
        dispatch.fail('no-path', 'terrain blocked');
        const [failed] = lifecycle.advance(state);
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('no-path');
    });

    it('checkpoints visited keys, index, and steps', () => {
        const skill = new ExploreSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context();
        const [started] = lifecycle.start(
            'explore',
            { waypoints: [firstWaypoint, secondWaypoint] },
            state,
        );
        if (started === null) return;
        dispatch.complete();
        const [moving] = lifecycle.advance(state);
        if (moving === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(state, moving.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.visited).toEqual(['4,64,0']);
        expect(checkpoint?.state.index).toBe(1);
        expect(checkpoint?.state.steps).toBe(1);
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restoreError).toBeNull();
        expect(restored?.state.visited).toEqual(['4,64,0']);
    });
});

import type {
    ActionDispatchPort,
    ActionFailureClass,
    ActionOutcome,
    ActionRequest,
    Result,
    Vec3,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { ClearSkill } from './clear.js';
import { EffectsEmitter } from './effects-emitter.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { SkillRegistry } from './registry.js';
import type { Skill, SkillBlock, SkillContext, SkillGrantPort, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    constructor(
        private readonly blocks: ReadonlyMap<string, string>,
        private readonly listedBlocks: readonly SkillBlock[] = [],
        private readonly fallback: string = 'air',
    ) {}

    blockAt(position: Vec3): string | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? this.fallback;
    }

    nearestContainer(): Vec3 | null {
        return null;
    }

    blocksInBox(): readonly SkillBlock[] {
        return this.listedBlocks;
    }
}

class FakeGrants implements SkillGrantPort {
    constructor(private readonly allowed: boolean) {}

    validate(): Result<boolean, string> {
        return [this.allowed, null];
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
        world: new FakeWorld(new Map()),
        hostiles: [],
        nearestHostile: null,
        lastAction: null,
        services: { grants: new FakeGrants(true) },
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

const grant = { id: 'grant-1' };
const target = {
    position: { x: 1, y: 64, z: 0 },
    itemName: 'stone',
    expectedBlockId: 'stone',
};

describe('clear skill', () => {
    it('breaks permitted blocks and collects their drops', () => {
        const skill = new ClearSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            world: new FakeWorld(new Map([['1,64,0', 'stone']])),
        });
        const [started, startError] = lifecycle.start('clear', { blocks: [target], grant }, state);
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({
            kind: 'break-block',
            position: target.position,
            expectedBlockId: 'stone',
        });

        dispatch.complete();
        const [collecting] = lifecycle.advance(state);
        expect(collecting?.action?.kind).toBe('collect-drops');

        dispatch.complete();
        const [completed] = lifecycle.advance(state);
        expect(completed?.status).toBe('completed');
    });

    it('derives permitted blocks from a bbox and blockIds', () => {
        const skill = new ClearSkill();
        const { lifecycle } = lifecycleFor(skill);
        const first = { x: 0, y: 64, z: 0 };
        const second = { x: 0, y: 64, z: 1 };
        const state = context({
            world: new FakeWorld(
                new Map([
                    ['0,64,0', 'stone'],
                    ['0,64,1', 'dirt'],
                ]),
                [
                    { position: first, name: 'stone', properties: {} },
                    { position: second, name: 'dirt', properties: {} },
                ],
            ),
        });
        const [started, startError] = lifecycle.start(
            'clear',
            {
                bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 0, y: 64, z: 1 } },
                blockIds: ['stone'],
                grant,
            },
            state,
        );
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({ position: first });
        expect(started?.run.state.remainingKeys).toEqual(['0,64,0']);
    });

    it('skips blocks that are already air', () => {
        const skill = new ClearSkill();
        const { lifecycle } = lifecycleFor(skill);
        const skipped = { position: { x: 0, y: 64, z: 0 }, itemName: 'stone' };
        const state = context({
            world: new FakeWorld(new Map([['1,64,0', 'stone']])),
        });
        const [started] = lifecycle.start('clear', { blocks: [skipped, target], grant }, state);
        expect(started?.action).toMatchObject({ position: target.position });
    });

    it('requires a grant and a grant validator', () => {
        const skill = new ClearSkill();
        const [missingGrant, missingGrantError] = skill.canRun(context(), { blocks: [target] });
        expect(missingGrant).toBeNull();
        expect(missingGrantError).toBe('grant required');

        const [missingValidator, missingValidatorError] = skill.canRun(
            context({ services: undefined }),
            { blocks: [target], grant },
        );
        expect(missingValidator).toBeNull();
        expect(missingValidatorError).toBe('grant required');

        const [rejected, rejectedError] = skill.canRun(
            context({ services: { grants: new FakeGrants(false) } }),
            { blocks: [target], grant },
        );
        expect(rejected).toBeNull();
        expect(rejectedError).toBe('grant required');
    });

    it('maps a blocked break action to its failure class', () => {
        const skill = new ClearSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            world: new FakeWorld(new Map([['1,64,0', 'stone']])),
        });
        lifecycle.start('clear', { blocks: [target], grant }, state);
        dispatch.fail('missing-tool', 'no pickaxe');
        const [failed] = lifecycle.advance(state);
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('missing-tool');
    });

    it('checkpoints remaining keys', () => {
        const skill = new ClearSkill();
        const { dispatch, lifecycle } = lifecycleFor(skill);
        const state = context({
            world: new FakeWorld(new Map([['1,64,0', 'stone']])),
        });
        const [started] = lifecycle.start('clear', { blocks: [target], grant }, state);
        if (started === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(state, started.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.remainingKeys).toEqual(['1,64,0']);
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
        expect(resumed?.action?.kind).toBe('collect-drops');
    });
});

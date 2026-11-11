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
import { PlaceBuildSkill } from './place-build.js';
import { SkillRegistry } from './registry.js';
import type {
    SkillBlock,
    SkillBlockState,
    SkillContext,
    SkillInventoryItem,
    SkillServices,
    SkillWorldView,
} from './types.js';

function key(position: Vec3): string {
    return `${position.x},${position.y},${position.z}`;
}

class FakeWorld implements SkillWorldView {
    private readonly blocks = new Map<string, SkillBlock>();

    constructor(blocks: readonly SkillBlock[] = []) {
        blocks.forEach((block) => this.blocks.set(key(block.position), block));
    }

    blockAt(position: Vec3): string | null {
        return this.blocks.get(key(position))?.name ?? null;
    }

    nearestContainer(): null {
        return null;
    }

    blockStateAt(position: Vec3): SkillBlockState | null {
        return this.blocks.get(key(position)) ?? null;
    }
}

class FakeDispatch implements ActionDispatchPort {
    lastRequest: ActionRequest | null = null;
    private outcome: ActionOutcome | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        this.lastRequest = request;
        this.outcome = null;
        return ['handle-1', null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        if (handleId !== 'handle-1') return [null, 'unknown handle'];
        return [this.outcome, null];
    }

    cancel(): Result<void, string> {
        return [undefined, null];
    }

    complete(): void {
        if (this.lastRequest === null) return;
        this.outcome = { request: this.lastRequest, status: 'completed' };
    }
}

function context(
    world: SkillWorldView,
    inventory: readonly SkillInventoryItem[] = [],
    lastAction: ActionOutcome | null = null,
    services?: SkillServices,
): SkillContext {
    return {
        botId: 'bot.builder',
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory,
        world,
        nearestHostile: null,
        lastAction,
        ...(services === undefined ? {} : { services }),
    };
}

function completed(request: ActionRequest): ActionOutcome {
    return { request, status: 'completed' };
}

function failed(request: ActionRequest, failureClass: ActionFailureClass): ActionOutcome {
    return {
        request,
        status: 'failed',
        message: 'action failed',
        failure: { class: failureClass, message: 'action failed' },
    };
}

describe('place-build skill', () => {
    it('places outstanding targets support-first and skips satisfied blocks', () => {
        const world = new FakeWorld([
            { position: { x: 0, y: 64, z: 0 }, name: 'stone', properties: {} },
        ]);
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const skill = new PlaceBuildSkill();
        const input = {
            blocks: [
                { position: { x: 1, y: 65, z: 0 }, itemName: 'oak_planks' },
                { position: { x: 1, y: 64, z: 0 }, itemName: 'oak_planks' },
                {
                    position: { x: 0, y: 64, z: 0 },
                    itemName: 'oak_planks',
                    expectedBlockId: 'stone',
                },
            ],
        };
        const [canRun, canRunError] = skill.canRun(context(world, inventory), input);
        expect(canRunError).toBeNull();
        expect(canRun).toBe(true);

        const [started, startError] = skill.start(context(world, inventory), input);
        expect(startError).toBeNull();
        expect(started?.status).toBe('running');
        expect(started?.action).toEqual({
            kind: 'place-block',
            position: { x: 1, y: 64, z: 0 },
            itemName: 'oak_planks',
            reference: { x: 1, y: 63, z: 0 },
            face: { x: 0, y: 1, z: 0 },
        });

        const placements: Vec3[] = [];
        let step = started;
        while (step?.status === 'running') {
            if (step.action?.kind === 'place-block') placements.push(step.action.position);
            const [next, stepError] = skill.step(
                context(world, inventory, completed(step.action as ActionRequest)),
                step.run,
            );
            expect(stepError).toBeNull();
            step = next;
        }
        expect(placements).toEqual([
            { x: 1, y: 64, z: 0 },
            { x: 1, y: 65, z: 0 },
        ]);
        expect(step?.status).toBe('completed');
    });

    it('dispatches through the lifecycle without catalog registration', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 1 }];
        const registry = new SkillRegistry();
        const [, registerError] = registry.register(new PlaceBuildSkill());
        expect(registerError).toBeNull();
        const dispatch = new FakeDispatch();
        const lifecycle = new SkillLifecycleExecutor({
            registry,
            dispatch,
            effects: new EffectsEmitter(),
        });
        const state = context(world, inventory);
        const [started, startError] = lifecycle.start(
            'place-build',
            { blocks: [{ position: { x: 0, y: 64, z: 0 }, itemName: 'oak_planks' }] },
            state,
        );
        expect(startError).toBeNull();
        expect(started?.action?.kind).toBe('place-block');
        expect(dispatch.lastRequest?.kind).toBe('place-block');

        dispatch.complete();
        const [completed, advanceError] = lifecycle.advance(state);
        expect(advanceError).toBeNull();
        expect(completed?.status).toBe('completed');
        expect(lifecycle.activeSkillId).toBeNull();
    });

    it('fails unsupported without a target source and missing-item without materials', () => {
        const world = new FakeWorld();
        const skill = new PlaceBuildSkill();
        const [canRun, canRunError] = skill.canRun(context(world), {});
        expect(canRunError).toBeNull();
        expect(canRun).toBe(false);

        const [unsupported] = skill.start(context(world), {});
        expect(unsupported?.status).toBe('failed');
        expect(unsupported?.failure?.class).toBe('unsupported');

        const [missing] = skill.start(context(world), {
            blocks: [{ position: { x: 0, y: 64, z: 0 }, itemName: 'oak_planks' }],
        });
        expect(missing?.status).toBe('failed');
        expect(missing?.failure?.class).toBe('missing-item');
    });

    it('reports a blocked path from a failed placement', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 1 }];
        const skill = new PlaceBuildSkill();
        const [started] = skill.start(context(world, inventory), {
            blocks: [{ position: { x: 0, y: 64, z: 0 }, itemName: 'oak_planks' }],
        });
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        const [blocked, blockedError] = skill.step(
            context(world, inventory, failed(started.action, 'no-path')),
            started.run,
        );
        expect(blockedError).toBeNull();
        expect(blocked?.status).toBe('failed');
        expect(blocked?.failure?.class).toBe('no-path');
    });

    it('checkpoints and restores cursor, placed keys, and work package', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const skill = new PlaceBuildSkill();
        const initialState = context(world, inventory);
        const [started] = skill.start(initialState, {
            taskId: 'wp-1',
            blocks: [
                { position: { x: 0, y: 64, z: 0 }, itemName: 'oak_planks' },
                { position: { x: 0, y: 65, z: 0 }, itemName: 'oak_planks' },
            ],
        });
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        const [advanced] = skill.step(
            context(world, inventory, completed(started.action)),
            started.run,
        );
        if (advanced === null) {
            expect(advanced).not.toBeNull();
            return;
        }
        const [checkpoint, checkpointError] = skill.checkpoint(initialState, advanced.run);
        expect(checkpointError).toBeNull();
        if (checkpoint === null) {
            expect(checkpoint).not.toBeNull();
            return;
        }
        expect(checkpoint.state.cursor).toBe(1);
        expect(checkpoint.state.placed).toEqual(['0,64,0']);
        expect(checkpoint.state.workPackageId).toBe('wp-1');

        const [restored, restoreError] = skill.restore(initialState, checkpoint);
        expect(restoreError).toBeNull();
        if (restored === null) {
            expect(restored).not.toBeNull();
            return;
        }
        const [resumed] = skill.step(context(world, inventory), restored);
        expect(resumed?.status).toBe('running');
        expect(resumed?.action).toEqual({
            kind: 'place-block',
            position: { x: 0, y: 65, z: 0 },
            itemName: 'oak_planks',
            reference: { x: 0, y: 64, z: 0 },
            face: { x: 0, y: 1, z: 0 },
        });
    });
});

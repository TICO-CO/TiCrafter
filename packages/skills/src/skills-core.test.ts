import type { ActionFailureClass, ActionOutcome, ActionRequest, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { CollectSkill } from './collect.js';
import { CraftSkill } from './craft.js';
import { DepositSkill } from './deposit.js';
import { EatSkill } from './eat.js';
import { FleeDefendSkill } from './flee-defend.js';
import { FollowPathSkill } from './follow-path.js';
import { MineSkill } from './mine.js';
import { NavigateSkill } from './navigate.js';
import type {
    Skill,
    SkillContext,
    SkillFailureClass,
    SkillInput,
    SkillWorldView,
} from './types.js';
import { WithdrawSkill } from './withdraw.js';

class FakeWorld implements SkillWorldView {
    readonly blocks = new Map<string, string>();
    container: Vec3 | null = null;

    blockAt(position: Vec3): string | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? 'air';
    }

    nearestContainer(): Vec3 | null {
        return this.container;
    }
}

function context(overrides: Partial<SkillContext> = {}): SkillContext {
    return {
        botId: 'bot.tibot1',
        taskId: 'task-1',
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [{ name: 'bread', count: 2 }],
        world: new FakeWorld(),
        nearestHostile: null,
        lastAction: null,
        ...overrides,
    };
}

function completed(request: ActionRequest): ActionOutcome {
    return { request, status: 'completed' };
}

function failed(
    request: ActionRequest,
    failureClass: ActionFailureClass,
    message: string,
): ActionOutcome {
    return { request, status: 'failed', message, failure: { class: failureClass, message } };
}

const planCases: readonly { skill: Skill; input: SkillInput }[] = [
    { skill: new NavigateSkill(), input: { target: { x: 1, y: 64, z: 0 } } },
    { skill: new FollowPathSkill(), input: { waypoints: [{ x: 1, y: 64, z: 0 }] } },
    { skill: new MineSkill(), input: { target: { x: 1, y: 64, z: 0 } } },
    { skill: new CollectSkill(), input: { radius: 4 } },
    { skill: new CraftSkill(), input: { itemName: 'stick', count: 1 } },
    { skill: new EatSkill(), input: { itemName: 'bread' } },
    {
        skill: new DepositSkill(),
        input: { itemName: 'dirt', container: { x: 1, y: 64, z: 0 } },
    },
    {
        skill: new WithdrawSkill(),
        input: { itemName: 'dirt', container: { x: 1, y: 64, z: 0 } },
    },
    { skill: new FleeDefendSkill(), input: {} },
];

const checkpointCases: readonly { skill: Skill; state: Record<string, unknown> }[] = [
    {
        skill: new NavigateSkill(),
        state: { target: { x: 4, y: 64, z: 0 }, range: 1 },
    },
    {
        skill: new FollowPathSkill(),
        state: { waypoints: [{ x: 1, y: 64, z: 0 }], index: 0, range: 1 },
    },
    {
        skill: new MineSkill(),
        state: {
            target: { x: 1, y: 64, z: 0 },
            expectedBlockId: 'stone',
            phase: 'break',
            radius: 4,
        },
    },
    { skill: new CollectSkill(), state: { radius: 8 } },
    { skill: new CraftSkill(), state: { itemName: 'stick', count: 1 } },
    { skill: new EatSkill(), state: { itemName: 'bread', threshold: 20 } },
    {
        skill: new DepositSkill(),
        state: { container: { x: 1, y: 64, z: 0 }, itemName: 'dirt', count: 1 },
    },
    {
        skill: new WithdrawSkill(),
        state: { container: { x: 1, y: 64, z: 0 }, itemName: 'dirt', count: 1 },
    },
    { skill: new FleeDefendSkill(), state: {} },
];

const failureCases: readonly {
    skill: Skill;
    state: Record<string, unknown>;
    actionFailure: ActionFailureClass;
    expected: SkillFailureClass;
}[] = [
    {
        skill: new NavigateSkill(),
        state: { target: { x: 4, y: 64, z: 0 }, range: 1 },
        actionFailure: 'no-path',
        expected: 'no-path',
    },
    {
        skill: new FollowPathSkill(),
        state: { waypoints: [{ x: 1, y: 64, z: 0 }], index: 0, range: 1 },
        actionFailure: 'timeout',
        expected: 'timeout',
    },
    {
        skill: new MineSkill(),
        state: { target: { x: 1, y: 64, z: 0 }, phase: 'break' },
        actionFailure: 'target-missing',
        expected: 'target-missing',
    },
    {
        skill: new CollectSkill(),
        state: { radius: 8 },
        actionFailure: 'missing-item',
        expected: 'missing-item',
    },
    {
        skill: new CraftSkill(),
        state: { itemName: 'stick', count: 1 },
        actionFailure: 'missing-tool',
        expected: 'missing-tool',
    },
    {
        skill: new EatSkill(),
        state: { itemName: 'bread', threshold: 20 },
        actionFailure: 'unsafe',
        expected: 'unsafe',
    },
    {
        skill: new DepositSkill(),
        state: { container: { x: 1, y: 64, z: 0 }, itemName: 'dirt', count: 1 },
        actionFailure: 'invalid',
        expected: 'invalid-input',
    },
    {
        skill: new WithdrawSkill(),
        state: { container: { x: 1, y: 64, z: 0 }, itemName: 'dirt', count: 1 },
        actionFailure: 'preempted',
        expected: 'preempted',
    },
    {
        skill: new FleeDefendSkill(),
        state: {},
        actionFailure: 'execution-failed',
        expected: 'execution-failed',
    },
];

describe('catalog skills', () => {
    it('returns planned input unchanged for every skill', () => {
        for (const { skill, input } of planCases) {
            const [planned, planError] = skill.plan(context(), input);
            expect(planError).toBeNull();
            expect(planned).toEqual(input);
        }
    });

    it('round-trips checkpoint state for every skill', () => {
        for (const { skill, state } of checkpointCases) {
            const current = context();
            const run = { skillId: skill.id, state };
            const [checkpoint, checkpointError] = skill.checkpoint(current, run);
            expect(checkpointError).toBeNull();
            if (checkpoint === null) return;
            expect(checkpoint.botId).toBe(current.botId);
            expect(checkpoint.taskId).toBe('task-1');
            expect(checkpoint.skillId).toBe(skill.id);
            const [restored, restoreError] = skill.restore(current, checkpoint);
            expect(restoreError).toBeNull();
            expect(restored?.state).toEqual(state);
        }
    });

    it('maps action failures to skill failure classes', () => {
        for (const { skill, state, actionFailure, expected } of failureCases) {
            const [step, stepError] = skill.step(
                context({
                    lastAction: failed({ kind: 'wait', milliseconds: 1 }, actionFailure, 'boom'),
                }),
                { skillId: skill.id, state },
            );
            expect(stepError).toBeNull();
            expect(step?.status).toBe('failed');
            expect(step?.failure?.class).toBe(expected);
        }
    });
});

describe('NavigateSkill', () => {
    it('moves to a distant target and completes when it arrives', () => {
        const skill = new NavigateSkill();
        const state = context();
        const target = { x: 4, y: 64, z: 0 };
        const [started, startError] = skill.start(state, { target });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({ kind: 'move-to', position: target, range: 1 });
        if (started === null || started.action === null) return;

        const [completedStep, stepError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(stepError).toBeNull();
        expect(completedStep?.status).toBe('completed');

        const [near, nearError] = skill.start(state, { target: state.position });
        expect(nearError).toBeNull();
        expect(near?.status).toBe('completed');
    });

    it('rejects missing targets and corrupt run state', () => {
        const skill = new NavigateSkill();
        const state = context();
        const [allowed, canRunError] = skill.canRun(state, {});
        expect(allowed).toBeNull();
        expect(canRunError).toBe('navigate requires a target');

        const [started, startError] = skill.start(state, {});
        expect(started).toBeNull();
        expect(startError).toBe('navigate requires a target');

        const [step, stepError] = skill.step(state, { skillId: 'navigate', state: {} });
        expect(step).toBeNull();
        expect(stepError).toBe('navigate state lost its target');
    });

    it('rejects checkpoints without a target', () => {
        const skill = new NavigateSkill();
        const state = context();
        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'navigate',
            state: {},
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no navigation target');
    });
});

describe('FollowPathSkill', () => {
    it('advances through every waypoint and completes the path', () => {
        const skill = new FollowPathSkill();
        const state = context();
        const first = { x: 1, y: 64, z: 0 };
        const second = { x: 2, y: 64, z: 0 };
        const [started, startError] = skill.start(state, { waypoints: [first, second] });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({ kind: 'move-to', position: first, range: 1 });
        if (started === null || started.action === null) return;

        const [next, nextError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(nextError).toBeNull();
        expect(next?.action).toEqual({ kind: 'move-to', position: second, range: 1 });
        if (next === null || next.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(next.action) },
            next.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('rejects empty paths and corrupt run state', () => {
        const skill = new FollowPathSkill();
        const state = context();
        const [allowed, canRunError] = skill.canRun(state, { waypoints: [] });
        expect(allowed).toBeNull();
        expect(canRunError).toBe('follow-path requires waypoints');

        const [started, startError] = skill.start(state, { waypoints: [] });
        expect(started).toBeNull();
        expect(startError).toBe('follow-path requires waypoints');

        const [step, stepError] = skill.step(state, { skillId: 'follow-path', state: {} });
        expect(step).toBeNull();
        expect(stepError).toBe('follow-path state lost waypoints');
    });

    it('rejects checkpoints without waypoints', () => {
        const skill = new FollowPathSkill();
        const state = context();
        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'follow-path',
            state: {},
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no waypoints');
    });
});

describe('MineSkill', () => {
    it('breaks the block then collects drops', () => {
        const skill = new MineSkill();
        const world = new FakeWorld();
        world.blocks.set('1,64,0', 'stone');
        const state = context({ world });
        const target = { x: 1, y: 64, z: 0 };
        const [started, startError] = skill.start(state, { target });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'break-block',
            position: target,
            expectedBlockId: 'stone',
        });
        if (started === null || started.action === null) return;

        const [collecting, collectingError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(collectingError).toBeNull();
        expect(collecting?.action).toEqual({ kind: 'collect-drops', radius: 4 });
        if (collecting === null || collecting.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(collecting.action) },
            collecting.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('rejects missing blocks and corrupt run state', () => {
        const skill = new MineSkill();
        const state = context();
        const [allowed, canRunError] = skill.canRun(state, {});
        expect(allowed).toBeNull();
        expect(canRunError).toBe('mine requires a target');

        const [started, startError] = skill.start(state, { target: { x: 1, y: 64, z: 0 } });
        expect(started).toBeNull();
        expect(startError).toBe('mine target is missing');

        const [step, stepError] = skill.step(state, { skillId: 'mine', state: {} });
        expect(step).toBeNull();
        expect(stepError).toBe('mine state lost its target');
    });

    it('rejects checkpoints without a target', () => {
        const skill = new MineSkill();
        const state = context();
        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'mine',
            state: {},
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no mining target');
    });
});

describe('CollectSkill', () => {
    it('collects drops within the requested radius', () => {
        const skill = new CollectSkill();
        const state = context();
        const [allowed, canRunError] = skill.canRun(state, {});
        expect(canRunError).toBeNull();
        expect(allowed).toBe(true);

        const [started, startError] = skill.start(state, { radius: 6, itemName: 'diamond' });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'collect-drops',
            radius: 6,
            itemName: 'diamond',
        });
        if (started === null || started.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('keeps collecting while no outcome is available', () => {
        const skill = new CollectSkill();
        const [step, stepError] = skill.step(context(), { skillId: 'collect', state: {} });
        expect(stepError).toBeNull();
        expect(step?.status).toBe('running');
        expect(step?.action).toEqual({ kind: 'collect-drops', radius: 8 });
    });
});

describe('CraftSkill', () => {
    it('crafts the requested item and count', () => {
        const skill = new CraftSkill();
        const state = context();
        const [started, startError] = skill.start(state, { itemName: 'stick', count: 2 });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({ kind: 'craft', itemName: 'stick', count: 2 });
        if (started === null || started.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('rejects invalid craft input and corrupt run state', () => {
        const skill = new CraftSkill();
        const state = context();
        const [missing, missingError] = skill.canRun(state, {});
        expect(missing).toBeNull();
        expect(missingError).toBe('craft requires an item name');

        const [zero, zeroError] = skill.canRun(state, { itemName: 'stick', count: 0 });
        expect(zero).toBeNull();
        expect(zeroError).toBe('craft count must be positive');

        const [started, startError] = skill.start(state, {});
        expect(started).toBeNull();
        expect(startError).toBe('craft requires an item name');

        const [step, stepError] = skill.step(state, { skillId: 'craft', state: {} });
        expect(step).toBeNull();
        expect(stepError).toBe('craft state lost its item');
    });

    it('rejects checkpoints without a craft item', () => {
        const skill = new CraftSkill();
        const state = context();
        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'craft',
            state: { count: 1 },
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no craft item');
    });
});

describe('EatSkill', () => {
    it('consumes the first food when hungry', () => {
        const skill = new EatSkill();
        const state = context({ food: 10 });
        const [allowed, canRunError] = skill.canRun(state, {});
        expect(canRunError).toBeNull();
        expect(allowed).toBe(true);

        const [started, startError] = skill.start(state, {});
        expect(startError).toBeNull();
        expect(started?.action).toEqual({ kind: 'consume', itemName: 'bread' });
        if (started === null || started.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('refuses to eat when full or without food', () => {
        const skill = new EatSkill();
        const [full, fullError] = skill.canRun(context({ food: 20 }), {});
        expect(fullError).toBeNull();
        expect(full).toBe(false);

        const [empty, emptyError] = skill.canRun(context({ food: 10, inventory: [] }), {});
        expect(emptyError).toBeNull();
        expect(empty).toBe(false);

        const [started, startError] = skill.start(context({ food: 10, inventory: [] }), {});
        expect(started).toBeNull();
        expect(startError).toBe('no food available');

        const [step, stepError] = skill.step(context({ food: 10 }), {
            skillId: 'eat',
            state: {},
        });
        expect(step).toBeNull();
        expect(stepError).toBe('eat state lost its item');
    });

    it('rejects checkpoints without a food item', () => {
        const skill = new EatSkill();
        const state = context();
        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'eat',
            state: {},
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no food item');
    });
});

describe('DepositSkill', () => {
    it('deposits into an explicit container and completes', () => {
        const skill = new DepositSkill();
        const state = context();
        const container = { x: 2, y: 64, z: 0 };
        const [started, startError] = skill.start(state, {
            itemName: 'dirt',
            count: 3,
            container,
        });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'transfer',
            direction: 'deposit',
            container,
            itemName: 'dirt',
            count: 3,
        });
        if (started === null || started.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('uses the nearest container and rejects missing containers', () => {
        const skill = new DepositSkill();
        const world = new FakeWorld();
        world.container = { x: 3, y: 64, z: 0 };
        const state = context({ world });
        const [started, startError] = skill.start(state, { itemName: 'dirt' });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'transfer',
            direction: 'deposit',
            container: { x: 3, y: 64, z: 0 },
            itemName: 'dirt',
            count: 1,
        });

        const [allowed, canRunError] = skill.canRun(state, { itemName: 'dirt' });
        expect(canRunError).toBeNull();
        expect(allowed).toBe(true);

        const [blocked, blockedError] = skill.canRun(context({ inventory: [] }), {});
        expect(blocked).toBeNull();
        expect(blockedError).toBe('deposit requires an item name');

        const [unavailable, unavailableError] = skill.canRun(context(), { itemName: 'dirt' });
        expect(unavailableError).toBeNull();
        expect(unavailable).toBe(false);

        const [missing, missingError] = skill.start(context(), { itemName: 'dirt' });
        expect(missing).toBeNull();
        expect(missingError).toBe('no container nearby');
    });

    it('rejects corrupt run state and checkpoints without a container', () => {
        const skill = new DepositSkill();
        const state = context();
        const [step, stepError] = skill.step(state, {
            skillId: 'deposit',
            state: { itemName: 'dirt' },
        });
        expect(step).toBeNull();
        expect(stepError).toBe('deposit state is invalid');

        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'deposit',
            state: { itemName: 'dirt' },
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no container');
    });
});

describe('WithdrawSkill', () => {
    it('withdraws from an explicit container and completes', () => {
        const skill = new WithdrawSkill();
        const state = context();
        const container = { x: 2, y: 64, z: 0 };
        const [started, startError] = skill.start(state, {
            itemName: 'dirt',
            count: 3,
            container,
        });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'transfer',
            direction: 'withdraw',
            container,
            itemName: 'dirt',
            count: 3,
        });
        if (started === null || started.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('uses the nearest container and rejects missing containers', () => {
        const skill = new WithdrawSkill();
        const world = new FakeWorld();
        world.container = { x: 3, y: 64, z: 0 };
        const state = context({ world });
        const [started, startError] = skill.start(state, { itemName: 'dirt' });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'transfer',
            direction: 'withdraw',
            container: { x: 3, y: 64, z: 0 },
            itemName: 'dirt',
            count: 1,
        });

        const [allowed, canRunError] = skill.canRun(state, { itemName: 'dirt' });
        expect(canRunError).toBeNull();
        expect(allowed).toBe(true);

        const [blocked, blockedError] = skill.canRun(context({ inventory: [] }), {});
        expect(blocked).toBeNull();
        expect(blockedError).toBe('withdraw requires an item name');

        const [unavailable, unavailableError] = skill.canRun(context(), { itemName: 'dirt' });
        expect(unavailableError).toBeNull();
        expect(unavailable).toBe(false);

        const [missing, missingError] = skill.start(context(), { itemName: 'dirt' });
        expect(missing).toBeNull();
        expect(missingError).toBe('no container nearby');
    });

    it('rejects corrupt run state and checkpoints without a container', () => {
        const skill = new WithdrawSkill();
        const state = context();
        const [step, stepError] = skill.step(state, {
            skillId: 'withdraw',
            state: { itemName: 'dirt' },
        });
        expect(step).toBeNull();
        expect(stepError).toBe('withdraw state is invalid');

        const [checkpoint, checkpointError] = skill.checkpoint(state, {
            skillId: 'withdraw',
            state: { itemName: 'dirt' },
        });
        expect(checkpointError).toBeNull();
        if (checkpoint === null) return;

        const [restored, restoreError] = skill.restore(state, checkpoint);
        expect(restored).toBeNull();
        expect(restoreError).toBe('checkpoint has no container');
    });
});

describe('FleeDefendSkill', () => {
    it('attacks a distant hostile and completes', () => {
        const skill = new FleeDefendSkill();
        const hostile = {
            entityId: 42,
            name: 'zombie',
            position: { x: 5, y: 64, z: 0 },
            distance: 10,
        };
        const state = context({ nearestHostile: hostile });
        const [allowed, canRunError] = skill.canRun(state, {});
        expect(canRunError).toBeNull();
        expect(allowed).toBe(true);

        const [started, startError] = skill.start(state, {});
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'attack',
            entityId: 42,
            entityName: 'zombie',
        });
        if (started === null || started.action === null) return;

        const [done, doneError] = skill.step(
            { ...state, lastAction: completed(started.action) },
            started.run,
        );
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });

    it('flees when health is low', () => {
        const skill = new FleeDefendSkill();
        const state = context({
            health: 7,
            nearestHostile: {
                name: 'zombie',
                position: { x: 5, y: 64, z: 0 },
                distance: 10,
            },
        });
        const [fleeing, fleeError] = skill.start(state, {});
        expect(fleeError).toBeNull();
        expect(fleeing?.action).toEqual({
            kind: 'move-to',
            position: { x: -10, y: 64, z: 0 },
            range: 1,
        });
    });

    it('finishes when no threat remains and rejects missing hostiles', () => {
        const skill = new FleeDefendSkill();
        const state = context();
        const [allowed, canRunError] = skill.canRun(state, {});
        expect(canRunError).toBeNull();
        expect(allowed).toBe(false);

        const [started, startError] = skill.start(state, {});
        expect(started).toBeNull();
        expect(startError).toBe('no hostile mob nearby');

        const [done, doneError] = skill.step(state, { skillId: 'flee-defend', state: {} });
        expect(doneError).toBeNull();
        expect(done?.status).toBe('completed');
    });
});

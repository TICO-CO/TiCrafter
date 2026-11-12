import type {
    ActionDispatchPort,
    ActionOutcome,
    ActionRequest,
    Result,
    Vec3,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { DigShelterSkill } from './dig-shelter.js';
import { EffectsEmitter } from './effects-emitter.js';
import { EquipGearSkill } from './equip-gear.js';
import { GatherFoodSkill } from './gather-food.js';
import { GatherWoolSkill } from './gather-wool.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { PlaceBedSkill } from './place-bed.js';
import { SkillRegistry } from './registry.js';
import type { Skill, SkillContext, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    constructor(
        private readonly entityList: readonly { id: number; name: string; position: Vec3 }[] = [],
    ) {}

    blockAt(): string | null {
        return 'stone';
    }

    nearestContainer(): Vec3 | null {
        return null;
    }

    entities(): readonly { id?: number; name: string; position: Vec3 }[] {
        return this.entityList;
    }
}

class FakeDispatch implements ActionDispatchPort {
    lastRequest: ActionRequest | null = null;
    outcome: ActionOutcome | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        this.lastRequest = request;
        this.outcome = null;
        return ['handle-1', null];
    }

    poll(): Result<ActionOutcome | null, string> {
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

function context(overrides: Partial<SkillContext> = {}): SkillContext {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-10T22:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 17_500,
        inventory: [],
        world: new FakeWorld(),
        hostiles: [],
        nearestHostile: null,
        lastAction: null,
        ...overrides,
    };
}

function start(skill: Skill, input: Record<string, unknown>, overrides: Partial<SkillContext>) {
    const dispatch = new FakeDispatch();
    const registry = new SkillRegistry();
    registry.register(skill);
    const lifecycle = new SkillLifecycleExecutor({
        registry,
        dispatch,
        effects: new EffectsEmitter(),
    });
    const [step, error] = lifecycle.start(skill.id, input, context(overrides));
    return { dispatch, lifecycle, step, error };
}

describe('night skills', () => {
    it('equips a weapon and armor', () => {
        const skill = new EquipGearSkill();
        const { dispatch, error } = start(
            skill,
            {},
            {
                inventory: [
                    { name: 'iron_sword', count: 1 },
                    { name: 'iron_helmet', count: 1 },
                ],
            },
        );
        expect(error).toBeNull();
        expect(dispatch.lastRequest?.kind).toBe('equip');
    });

    it('places a bed at the target', () => {
        const skill = new PlaceBedSkill();
        const { dispatch, error } = start(
            skill,
            { itemName: 'red_bed', target: { x: 0, y: 64, z: 0 } },
            { inventory: [{ name: 'red_bed', count: 1 }] },
        );
        expect(error).toBeNull();
        expect(dispatch.lastRequest?.kind).toBe('place-block');
    });

    it('prefers the highest-tier weapon', () => {
        const skill = new EquipGearSkill();
        const { dispatch, error } = start(
            skill,
            {},
            {
                inventory: [
                    { name: 'wooden_sword', count: 1 },
                    { name: 'iron_sword', count: 1 },
                ],
            },
        );
        expect(error).toBeNull();
        expect(dispatch.lastRequest).toMatchObject({ kind: 'equip', itemName: 'iron_sword' });
    });

    it('does not retry the same sheared sheep forever', () => {
        const skill = new GatherWoolSkill();
        const sheep = { id: 7, name: 'sheep', position: { x: 1, y: 64, z: 0 } };
        const world = new FakeWorld([sheep]);
        const value = context({ inventory: [{ name: 'shears', count: 1 }], world });
        const [started] = skill.start(value, { count: 3 });
        expect(started === null).toBe(false);
        if (started === null) return;
        let run = started.run;
        const advance = (step: NonNullable<typeof started>) => {
            const [next, error] = skill.step(
                {
                    ...value,
                    lastAction:
                        step.action === null ? null : { request: step.action, status: 'completed' },
                },
                run,
            );
            expect(error).toBeNull();
            if (next !== null) run = next.run;
            return next;
        };
        const equip = advance(started);
        const use = equip === null ? null : advance(equip);
        const collect = use === null ? null : advance(use);
        const failed = collect === null ? null : advance(collect);
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('target-missing');
    });

    it('starts shearing a sheep when shears are available', () => {
        const skill = new GatherWoolSkill();
        const { dispatch, error } = start(
            skill,
            { count: 3 },
            {
                inventory: [{ name: 'shears', count: 1 }],
                world: new FakeWorld([{ id: 7, name: 'sheep', position: { x: 1, y: 64, z: 0 } }]),
            },
        );
        expect(error).toBeNull();
        expect(dispatch.lastRequest?.kind).toBe('equip');
    });

    it('hunts a passive animal when food is missing', () => {
        const skill = new GatherFoodSkill();
        const { dispatch, error } = start(
            skill,
            { count: 3 },
            {
                world: new FakeWorld([{ id: 8, name: 'cow', position: { x: 1, y: 64, z: 0 } }]),
            },
        );
        expect(error).toBeNull();
        expect(dispatch.lastRequest?.kind).toBe('attack');
    });

    it('refills every dug block when leaving the shelter', () => {
        const skill = new DigShelterSkill();
        const contextValue = context({
            inventory: [{ name: 'cobblestone', count: 8 }],
            timeOfDay: 17_500,
        });
        const [started] = skill.start(contextValue, { target: { x: 1, y: 64, z: 0 } });
        expect(started === null).toBe(false);
        if (started === null) return;
        let run = started.run;
        let action = started.action;
        expect(action?.kind).toBe('break-block');

        const advance = (currentAction: ActionRequest | null, nextContext: SkillContext) => {
            const outcome: ActionOutcome | null =
                currentAction === null ? null : { request: currentAction, status: 'completed' };
            const [step, error] = skill.step({ ...nextContext, lastAction: outcome }, run);
            expect(error).toBeNull();
            if (step === null) return null;
            run = step.run;
            action = step.action;
            return step;
        };

        advance(action, contextValue);
        advance(action, contextValue);
        advance(action, contextValue);
        advance(action, contextValue);
        const daylight = { ...contextValue, timeOfDay: 7_000 };
        advance(action, daylight);
        advance(action, daylight);
        advance(action, daylight);
        expect(action?.kind).toBe('place-block');
        advance(action, daylight);
        const [completed] = skill.step(
            {
                ...daylight,
                lastAction: {
                    request: action ?? { kind: 'wait', milliseconds: 1 },
                    status: 'completed',
                },
            },
            run,
        );
        expect(completed?.status).toBe('completed');
        const positions = run.state.ledger;
        expect(Array.isArray(positions)).toBe(true);
    });

    it('starts digging a shelter pocket', () => {
        const skill = new DigShelterSkill();
        const { dispatch, error } = start(
            skill,
            { target: { x: 1, y: 64, z: 0 } },
            { inventory: [{ name: 'cobblestone', count: 8 }] },
        );
        expect(error).toBeNull();
        expect(dispatch.lastRequest?.kind).toBe('break-block');
    });

    it('keeps the same dig target until the break completes', () => {
        const skill = new DigShelterSkill();
        const value = context({ inventory: [{ name: 'cobblestone', count: 8 }] });
        const [started] = skill.start(value, { target: { x: 1, y: 64, z: 0 } });
        expect(started === null).toBe(false);
        if (started === null) return;
        const [step, error] = skill.step({ ...value, lastAction: null }, started.run);
        expect(error).toBeNull();
        expect(step?.action).toEqual(started.action);
        expect(step?.run.state.digIndex).toBe(0);
    });
});

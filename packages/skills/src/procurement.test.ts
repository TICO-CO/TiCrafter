import type { ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { ProcurementSkill } from './procurement.js';
import type {
    SkillConstructionOperation,
    SkillConstructionPlan,
    SkillConstructionSource,
    SkillContext,
    SkillInput,
    SkillInventoryItem,
    SkillProcurementPlan,
    SkillProcurementPort,
    SkillServices,
    SkillWorldView,
} from './types.js';

class FakeWorld implements SkillWorldView {
    blocks: Record<string, string> = {};
    gatherTarget: { x: number; y: number; z: number } | null = null;

    blockAt(): string | null {
        return null;
    }

    nearestContainer(): null {
        return null;
    }

    nearestBlock(): { x: number; y: number; z: number } | null {
        return this.gatherTarget;
    }
}

class FakeSource implements SkillConstructionSource {
    plan: SkillConstructionPlan | null = null;

    resolve(): Result<SkillConstructionPlan, string> {
        if (this.plan === null) return [null, 'plan missing'];
        return [this.plan, null];
    }
}

class FakeProcurement implements SkillProcurementPort {
    plans: SkillProcurementPlan[] = [];
    readonly recorded: { action: unknown; status: string }[] = [];

    plan(): Result<SkillProcurementPlan, string> {
        return [this.plans.shift() ?? { actions: [], shortages: [], blocked: false }, null];
    }

    record(input: { action: unknown; status: 'completed' | 'failed' }): void {
        this.recorded.push({ action: input.action, status: input.status });
    }
}

const operation: SkillConstructionOperation = {
    kind: 'place',
    target: {
        position: { x: 0, y: 64, z: 0 },
        itemName: 'oak_planks',
        expectedBlockId: 'oak_planks',
    },
};

function plan(operations: readonly SkillConstructionOperation[]): SkillConstructionPlan {
    return {
        blueprintId: 'blueprint.home',
        blueprintRevision: 2,
        planId: 'plan.home',
        planRevision: 1,
        workPackageId: 'package.walls',
        phase: 'walls',
        operations,
        scaffoldPositions: [],
    };
}

function context(
    inventory: readonly SkillInventoryItem[],
    services: SkillServices,
    world: FakeWorld,
): SkillContext {
    return {
        botId: 'bot.builder',
        at: '2026-11-12T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory,
        world,
        hostiles: [],
        nearestHostile: null,
        lastAction: null,
        services,
    };
}

function completed(request: ActionRequest): ActionOutcome {
    return { request, status: 'completed' };
}

function setup(): {
    skill: ProcurementSkill;
    source: FakeSource;
    procurement: FakeProcurement;
    world: FakeWorld;
    services: SkillServices;
    input: SkillInput;
} {
    const source = new FakeSource();
    source.plan = plan([operation]);
    const procurement = new FakeProcurement();
    const world = new FakeWorld();
    return {
        skill: new ProcurementSkill(),
        source,
        procurement,
        world,
        services: { construction: source, procurement },
        input: { blueprintId: 'blueprint.home', blueprintRevision: 2 },
    };
}

describe('procurement skill', () => {
    it('completes immediately when materials are already available', () => {
        const { skill, procurement, world, services, input } = setup();

        const [step, error] = skill.start(
            context([{ name: 'oak_planks', count: 1 }], services, world),
            input,
        );

        expect(error).toBeNull();
        expect(step?.status).toBe('completed');
        expect(procurement.plans).toHaveLength(0);
    });

    it('withdraws missing materials before completing', () => {
        const { skill, procurement, world, services, input } = setup();
        procurement.plans.push({
            actions: [
                {
                    kind: 'withdraw',
                    container: { x: 4, y: 64, z: 0 },
                    item: 'oak_planks',
                    count: 1,
                },
            ],
            shortages: [],
            blocked: false,
        });
        procurement.plans.push({ actions: [], shortages: [], blocked: false });

        const [started, startError] = skill.start(context([], services, world), input);
        expect(startError).toBeNull();
        expect(started?.action).toMatchObject({
            kind: 'transfer',
            direction: 'withdraw',
            itemName: 'oak_planks',
            count: 1,
        });
        if (started === null || started.action === null) return;
        const [next] = skill.step(
            {
                ...context([{ name: 'oak_planks', count: 1 }], services, world),
                lastAction: completed(started.action),
            },
            started.run,
        );
        expect(next?.status).toBe('completed');
        expect(procurement.recorded).toHaveLength(1);
    });

    it('crafts when ingredients are available', () => {
        const { skill, procurement, world, services, input } = setup();
        procurement.plans.push({
            actions: [
                {
                    kind: 'craft',
                    item: 'oak_planks',
                    count: 1,
                    ingredients: [{ item: 'oak_log', count: 1 }],
                },
            ],
            shortages: [],
            blocked: false,
        });

        const [started] = skill.start(
            context([{ name: 'oak_log', count: 1 }], services, world),
            input,
        );

        expect(started?.action).toMatchObject({
            kind: 'craft',
            itemName: 'oak_planks',
            count: 1,
        });
    });

    it('acquires craft ingredients before crafting the target item', () => {
        const { skill, procurement, world, services, input } = setup();
        procurement.plans.push({
            actions: [
                {
                    kind: 'craft',
                    item: 'oak_planks',
                    count: 1,
                    ingredients: [{ item: 'oak_log', count: 2 }],
                },
            ],
            shortages: [],
            blocked: false,
        });
        procurement.plans.push({
            actions: [
                {
                    kind: 'withdraw',
                    container: { x: 4, y: 64, z: 0 },
                    item: 'oak_log',
                    count: 2,
                },
            ],
            shortages: [],
            blocked: false,
        });

        const [started] = skill.start(context([], services, world), input);

        expect(started?.action).toMatchObject({
            kind: 'transfer',
            direction: 'withdraw',
            itemName: 'oak_log',
            count: 2,
        });
    });

    it('gathers source blocks with move, break, and collect actions', () => {
        const { skill, procurement, world, services, input } = setup();
        world.gatherTarget = { x: 10, y: 64, z: 0 };
        procurement.plans.push({
            actions: [
                {
                    kind: 'gather',
                    item: 'oak_planks',
                    count: 1,
                    source: 'oak_log',
                },
            ],
            shortages: [],
            blocked: false,
        });
        procurement.plans.push({ actions: [], shortages: [], blocked: false });

        const [moving] = skill.start(context([], services, world), input);
        expect(moving?.action).toMatchObject({ kind: 'move-to' });
        if (moving === null || moving.action === null) return;
        const [breaking] = skill.step(
            {
                ...context([], services, world),
                lastAction: completed(moving.action),
            },
            moving.run,
        );
        expect(breaking?.action).toMatchObject({
            kind: 'break-block',
            expectedBlockId: 'oak_log',
        });
        if (breaking === null || breaking.action === null) return;
        const [collecting] = skill.step(
            {
                ...context([], services, world),
                lastAction: completed(breaking.action),
            },
            breaking.run,
        );
        expect(collecting?.action).toMatchObject({ kind: 'collect-drops' });
        if (collecting === null || collecting.action === null) return;
        const [next] = skill.step(
            {
                ...context([{ name: 'oak_planks', count: 1 }], services, world),
                lastAction: completed(collecting.action),
            },
            collecting.run,
        );
        expect(next?.status).toBe('completed');
    });

    it('fails closed when procurement is blocked', () => {
        const { skill, procurement, world, services, input } = setup();
        procurement.plans.push({
            actions: [],
            shortages: [{ item: 'diamond', count: 1 }],
            blocked: true,
        });

        const [started] = skill.start(context([], services, world), input);

        expect(started?.status).toBe('failed');
        expect(started?.failure?.class).toBe('missing-item');
    });

    it('checkpoints plan metadata and restores from a fresh plan', () => {
        const { skill, source, world, services, input } = setup();
        const initial = context([{ name: 'oak_planks', count: 1 }], services, world);
        const [started] = skill.start(initial, input);
        if (started === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(initial, started.run);

        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.planId).toBe('plan.home');
        source.plan = plan([operation]);
        const [restored, restoreError] = skill.restore(
            context([{ name: 'oak_planks', count: 1 }], services, world),
            checkpoint as NonNullable<typeof checkpoint>,
        );
        expect(restoreError).toBeNull();
        expect(restored?.state.workPackageId).toBe('package.walls');
    });
});

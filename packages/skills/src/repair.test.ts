import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { RepairSkill } from './repair.js';
import type {
    SkillBlock,
    SkillBlockState,
    SkillContext,
    SkillGrant,
    SkillGrantPort,
    SkillInventoryItem,
    SkillRepairDiff,
    SkillRepairDiffSource,
    SkillServices,
    SkillStep,
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

    blocksInBox(bbox: { min: Vec3; max: Vec3 }): readonly SkillBlock[] {
        return [...this.blocks.values()].filter(
            (block) =>
                block.position.x >= bbox.min.x &&
                block.position.x <= bbox.max.x &&
                block.position.y >= bbox.min.y &&
                block.position.y <= bbox.max.y &&
                block.position.z >= bbox.min.z &&
                block.position.z <= bbox.max.z,
        );
    }
}

class FakeDiff implements SkillRepairDiffSource {
    value: SkillRepairDiff = { missing: [], extra: [], mismatched: [] };

    diff(): Result<SkillRepairDiff, string> {
        return [this.value, null];
    }
}

class FakeGrants implements SkillGrantPort {
    valid = true;
    validationError: string | null = null;
    readonly calls: { grant: SkillGrant; botId: string }[] = [];

    validate(grant: SkillGrant, botId: string): Result<boolean, string> {
        this.calls.push({ grant, botId });
        if (this.validationError !== null) return [null, this.validationError];
        return [this.valid, null];
    }
}

function context(
    world: SkillWorldView,
    inventory: readonly SkillInventoryItem[] = [],
    services?: SkillServices,
    lastAction: ActionOutcome | null = null,
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

const GRANT: SkillGrant = { id: 'grant-1' };

describe('repair skill', () => {
    it('removes extras and places missing and mismatched blocks', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const diff = new FakeDiff();
        diff.value = {
            missing: [{ position: { x: 2, y: 64, z: 0 }, itemName: 'oak_planks' }],
            extra: [{ x: 0, y: 64, z: 0 }],
            mismatched: [{ position: { x: 1, y: 64, z: 0 }, itemName: 'oak_planks' }],
        };
        const grants = new FakeGrants();
        const services = { repairDiff: diff, grants };
        const skill = new RepairSkill();
        const input = { blocks: [], grant: GRANT };
        const [started] = skill.start(context(world, inventory, services), input);
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        expect(started.action).toEqual({
            kind: 'break-block',
            position: { x: 0, y: 64, z: 0 },
        });
        expect(grants.calls[0]?.botId).toBe('bot.builder');

        const kinds: string[] = [started.action.kind];
        let step: SkillStep | null = started;
        while (step?.status === 'running') {
            const [next, stepError] = skill.step(
                context(world, inventory, services, completed(step.action as ActionRequest)),
                step.run,
            );
            expect(stepError).toBeNull();
            if (next !== null && next.action !== null) kinds.push(next.action.kind);
            step = next;
        }
        expect(kinds).toEqual(['break-block', 'place-block', 'place-block']);
        expect(step?.status).toBe('completed');
    });

    it('computes missing and mismatched blocks from the world scan', () => {
        const world = new FakeWorld([
            { position: { x: 0, y: 64, z: 0 }, name: 'oak_planks', properties: {} },
            { position: { x: 2, y: 64, z: 0 }, name: 'dirt', properties: {} },
        ]);
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const skill = new RepairSkill();
        const input = {
            blocks: [
                { position: { x: 0, y: 64, z: 0 }, itemName: 'oak_planks' },
                { position: { x: 1, y: 64, z: 0 }, itemName: 'oak_planks' },
                { position: { x: 2, y: 64, z: 0 }, itemName: 'oak_planks' },
            ],
        };
        const [canRun, canRunError] = skill.canRun(context(world, inventory), input);
        expect(canRunError).toBeNull();
        expect(canRun).toBe(true);
        const [started] = skill.start(context(world, inventory), input);
        expect(started?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 1, y: 64, z: 0 },
        });
    });

    it('fails closed without a valid grant for extra blocks', () => {
        const world = new FakeWorld();
        const diff = new FakeDiff();
        diff.value = {
            missing: [],
            extra: [{ x: 0, y: 64, z: 0 }],
            mismatched: [],
        };
        const grants = new FakeGrants();
        const services = { repairDiff: diff, grants };
        const skill = new RepairSkill();

        const [missingGrant] = skill.start(context(world, [], services), { blocks: [] });
        expect(missingGrant?.status).toBe('failed');
        expect(missingGrant?.failure?.class).toBe('unsafe');

        grants.valid = false;
        const [invalidGrant] = skill.start(context(world, [], services), {
            blocks: [],
            grant: GRANT,
        });
        expect(invalidGrant?.status).toBe('failed');
        expect(invalidGrant?.failure?.class).toBe('unsafe');

        const [missingService] = skill.start(context(world, [], { repairDiff: diff }), {
            blocks: [],
            grant: GRANT,
        });
        expect(missingService?.status).toBe('failed');
        expect(missingService?.failure?.class).toBe('unsafe');
    });

    it('fails unsupported without a diff source or block scan', () => {
        const world = new FakeWorld();
        const skill = new RepairSkill();
        const [canRun, canRunError] = skill.canRun(context(world), {});
        expect(canRunError).toBeNull();
        expect(canRun).toBe(false);
        const [started] = skill.start(context(world), {});
        expect(started?.status).toBe('failed');
        expect(started?.failure?.class).toBe('unsupported');
    });

    it('checkpoints and restores the operation cursor', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const diff = new FakeDiff();
        diff.value = {
            missing: [{ position: { x: 2, y: 64, z: 0 }, itemName: 'oak_planks' }],
            extra: [{ x: 0, y: 64, z: 0 }],
            mismatched: [{ position: { x: 1, y: 64, z: 0 }, itemName: 'oak_planks' }],
        };
        const services = { repairDiff: diff, grants: new FakeGrants() };
        const skill = new RepairSkill();
        const initialState = context(world, inventory, services);
        const [started] = skill.start(initialState, { blocks: [], grant: GRANT });
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        const [advanced] = skill.step(
            context(world, inventory, services, completed(started.action)),
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
        expect(checkpoint.state.applied).toEqual(['break-block:0,64,0']);

        const [restored, restoreError] = skill.restore(initialState, checkpoint);
        expect(restoreError).toBeNull();
        if (restored === null) {
            expect(restored).not.toBeNull();
            return;
        }
        const [resumed] = skill.step(context(world, inventory, services), restored);
        expect(resumed?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 1, y: 64, z: 0 },
        });
    });
});

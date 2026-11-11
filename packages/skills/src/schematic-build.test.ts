import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { SchematicBuildSkill } from './schematic-build.js';
import type {
    SkillBuildTarget,
    SkillContext,
    SkillInventoryItem,
    SkillSchematicPipeline,
    SkillSchematicRef,
    SkillServices,
    SkillWorldView,
} from './types.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return null;
    }

    nearestContainer(): null {
        return null;
    }
}

class FakeSchematics implements SkillSchematicPipeline {
    readonly prepared: SkillSchematicRef[] = [];
    targets: readonly SkillBuildTarget[] = [];
    prepareError: string | null = null;

    prepare(reference: SkillSchematicRef): Result<readonly SkillBuildTarget[], string> {
        this.prepared.push(reference);
        if (this.prepareError !== null) return [null, this.prepareError];
        return [this.targets, null];
    }
}

function context(
    world: SkillWorldView,
    inventory: readonly SkillInventoryItem[],
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

const TARGETS: readonly SkillBuildTarget[] = [
    { position: { x: 0, y: 65, z: 0 }, itemName: 'oak_planks' },
    { position: { x: 0, y: 64, z: 0 }, itemName: 'oak_planks' },
];

describe('schematic-build skill', () => {
    it('prepares a schematic and places its targets support-first', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const schematics = new FakeSchematics();
        schematics.targets = TARGETS;
        const services = { schematics };
        const skill = new SchematicBuildSkill();
        const input = {
            schematic: { id: 'house', anchor: { x: 0, y: 64, z: 0 }, revision: 3 },
        };
        const [canRun, canRunError] = skill.canRun(
            context(world, inventory, null, services),
            input,
        );
        expect(canRunError).toBeNull();
        expect(canRun).toBe(true);

        const [started, startError] = skill.start(context(world, inventory, null, services), input);
        expect(startError).toBeNull();
        expect(schematics.prepared[0]?.id).toBe('house');
        expect(started?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 0, y: 64, z: 0 },
        });

        const placements: Vec3[] = [];
        let step = started;
        while (step?.status === 'running') {
            if (step.action?.kind === 'place-block') placements.push(step.action.position);
            const [next, stepError] = skill.step(
                context(world, inventory, completed(step.action as ActionRequest), services),
                step.run,
            );
            expect(stepError).toBeNull();
            step = next;
        }
        expect(placements).toEqual([
            { x: 0, y: 64, z: 0 },
            { x: 0, y: 65, z: 0 },
        ]);
        expect(step?.status).toBe('completed');
    });

    it('fails unsupported without a schematic or ready pipeline', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const skill = new SchematicBuildSkill();
        const [canRun, canRunError] = skill.canRun(context(world, inventory), {});
        expect(canRunError).toBeNull();
        expect(canRun).toBe(false);

        const [unsupported] = skill.start(context(world, inventory), {
            schematic: { id: 'house', anchor: { x: 0, y: 64, z: 0 } },
        });
        expect(unsupported?.status).toBe('failed');
        expect(unsupported?.failure?.class).toBe('unsupported');

        const schematics = new FakeSchematics();
        schematics.prepareError = 'parser unavailable';
        const [prepareFailed] = skill.start(context(world, inventory, null, { schematics }), {
            schematic: { id: 'house', anchor: { x: 0, y: 64, z: 0 } },
        });
        expect(prepareFailed?.status).toBe('failed');
        expect(prepareFailed?.failure?.class).toBe('unsupported');
    });

    it('checkpoints schematic id, revision, and cursor for restore', () => {
        const world = new FakeWorld();
        const inventory = [{ name: 'oak_planks', count: 2 }];
        const schematics = new FakeSchematics();
        schematics.targets = TARGETS;
        const services = { schematics };
        const skill = new SchematicBuildSkill();
        const initialState = context(world, inventory, null, services);
        const [started] = skill.start(initialState, {
            schematic: { id: 'house', anchor: { x: 0, y: 64, z: 0 }, revision: 3 },
        });
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        const [advanced] = skill.step(
            context(world, inventory, completed(started.action), services),
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
        expect(checkpoint.state.schematicId).toBe('house');
        expect(checkpoint.state.schematicRevision).toBe(3);
        expect(checkpoint.state.cursor).toBe(1);

        const [restored, restoreError] = skill.restore(initialState, checkpoint);
        expect(restoreError).toBeNull();
        if (restored === null) {
            expect(restored).not.toBeNull();
            return;
        }
        const [resumed] = skill.step(context(world, inventory, null, services), restored);
        expect(resumed?.status).toBe('running');
        expect(resumed?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 0, y: 65, z: 0 },
        });
    });
});

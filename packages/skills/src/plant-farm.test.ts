import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { PlantFarmSkill } from './plant-farm.js';
import type {
    SkillBBox,
    SkillBlock,
    SkillBlockState,
    SkillContext,
    SkillFarmPlot,
    SkillFarmPlotSource,
    SkillInput,
    SkillInventoryItem,
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

    blocksInBox(bbox: SkillBBox): readonly SkillBlock[] {
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

class NoScanWorld implements SkillWorldView {
    blockAt(): string | null {
        return null;
    }

    nearestContainer(): null {
        return null;
    }
}

class FakeFarms implements SkillFarmPlotSource {
    constructor(private readonly plot: SkillFarmPlot) {}

    getPlot(plotId: string): Result<SkillFarmPlot | null, string> {
        return [plotId === this.plot.id ? this.plot : null, null];
    }
}

function context(
    world: SkillWorldView,
    inventory: readonly SkillInventoryItem[] = [],
    services?: SkillServices,
    lastAction: ActionOutcome | null = null,
): SkillContext {
    return {
        botId: 'bot.farmer',
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory,
        world,
        hostiles: [],
        nearestHostile: null,
        lastAction,
        ...(services === undefined ? {} : { services }),
    };
}

function completed(request: ActionRequest): ActionOutcome {
    return { request, status: 'completed' };
}

const PLOT: SkillFarmPlot = {
    id: 'plot-1',
    bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 65, z: 0 } },
    seedItem: 'wheat_seeds',
};

const FARM: readonly SkillBlock[] = [
    { position: { x: 0, y: 64, z: 0 }, name: 'farmland', properties: { moisture: '7' } },
    { position: { x: 0, y: 65, z: 0 }, name: 'air', properties: {} },
    { position: { x: 1, y: 64, z: 0 }, name: 'farmland', properties: { moisture: '7' } },
    { position: { x: 1, y: 65, z: 0 }, name: 'wheat', properties: { age: '7' } },
    { position: { x: 2, y: 64, z: 0 }, name: 'farmland', properties: { moisture: '0' } },
    { position: { x: 2, y: 65, z: 0 }, name: 'air', properties: {} },
];

describe('plant-farm skill', () => {
    it('plants seeds on empty farmland and reports dry farmland', () => {
        const world = new FakeWorld(FARM);
        const inventory = [{ name: 'wheat_seeds', count: 2 }];
        const skill = new PlantFarmSkill();
        const input = { plot: PLOT };
        const [canRun, canRunError] = skill.canRun(context(world, inventory), input);
        expect(canRunError).toBeNull();
        expect(canRun).toBe(true);

        const [started] = skill.start(context(world, inventory), input);
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        expect(started.action).toEqual({
            kind: 'use-block',
            position: { x: 0, y: 64, z: 0 },
            itemName: 'wheat_seeds',
        });

        let step: SkillStep | null = started;
        const planted: Vec3[] = [];
        while (step?.status === 'running') {
            if (step.action?.kind === 'use-block') planted.push(step.action.position);
            const [next, stepError] = skill.step(
                context(world, inventory, undefined, completed(step.action as ActionRequest)),
                step.run,
            );
            expect(stepError).toBeNull();
            step = next;
        }
        expect(planted).toEqual([
            { x: 0, y: 64, z: 0 },
            { x: 2, y: 64, z: 0 },
        ]);
        expect(step?.status).toBe('completed');
        expect(step?.progress.label).toBe('planted 2 seeds; 1 dry farmland blocks');
    });

    it('fails missing-item for absent or insufficient seeds', () => {
        const world = new FakeWorld(FARM);
        const skill = new PlantFarmSkill();
        const [missing] = skill.start(context(world), { plot: PLOT });
        expect(missing?.status).toBe('failed');
        expect(missing?.failure?.class).toBe('missing-item');

        const [insufficient] = skill.start(context(world, [{ name: 'wheat_seeds', count: 1 }]), {
            plot: PLOT,
        });
        expect(insufficient?.status).toBe('failed');
        expect(insufficient?.failure?.class).toBe('missing-item');

        const [noSeed] = skill.start(context(world, [{ name: 'wheat_seeds', count: 2 }]), {
            plot: { id: 'plot-2', bbox: PLOT.bbox },
        });
        expect(noSeed?.status).toBe('failed');
        expect(noSeed?.failure?.class).toBe('missing-item');
    });

    it('rejects unsupported water maintenance and missing scans', () => {
        const world = new FakeWorld(FARM);
        const inventory = [{ name: 'wheat_seeds', count: 2 }];
        const skill = new PlantFarmSkill();
        const waterInput: SkillInput = { plot: PLOT, maintainWater: true };
        const [water] = skill.start(context(world, inventory), waterInput);
        expect(water?.status).toBe('failed');
        expect(water?.failure?.class).toBe('missing-item');

        const noScanWorld = new NoScanWorld();
        const [noScan, noScanError] = skill.canRun(context(noScanWorld, inventory), {
            plot: PLOT,
        });
        expect(noScanError).toBeNull();
        expect(noScan).toBe(false);
        const [unsupported] = skill.start(context(noScanWorld, inventory), { plot: PLOT });
        expect(unsupported?.status).toBe('failed');
        expect(unsupported?.failure?.class).toBe('unsupported');
    });

    it('checkpoints planted and pending keys across a farm service lookup', () => {
        const world = new FakeWorld(FARM);
        const inventory = [{ name: 'wheat_seeds', count: 2 }];
        const services = { farms: new FakeFarms(PLOT) };
        const skill = new PlantFarmSkill();
        const initialState = context(world, inventory, services);
        const [started] = skill.start(initialState, { plotId: 'plot-1' });
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
        expect(checkpoint.state.planted).toEqual(['0,64,0']);
        expect(checkpoint.state.pending).toHaveLength(1);
        expect(checkpoint.state.activeKey).toBe('2,64,0');
        expect(checkpoint.state.dryFarmland).toEqual(['2,64,0']);

        const [restored, restoreError] = skill.restore(initialState, checkpoint);
        expect(restoreError).toBeNull();
        if (restored === null) {
            expect(restored).not.toBeNull();
            return;
        }
        const [resumed] = skill.step(context(world, inventory, services), restored);
        expect(resumed?.action).toEqual({
            kind: 'use-block',
            position: { x: 2, y: 64, z: 0 },
            itemName: 'wheat_seeds',
        });
    });
});

import type { ActionOutcome, ActionRequest, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { HarvestFarmSkill } from './harvest-farm.js';
import type {
    SkillBBox,
    SkillBlock,
    SkillBlockState,
    SkillContext,
    SkillFarmPlot,
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

function context(world: SkillWorldView, lastAction: ActionOutcome | null = null): SkillContext {
    return {
        botId: 'bot.farmer',
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [],
        world,
        nearestHostile: null,
        lastAction,
    };
}

function completed(request: ActionRequest): ActionOutcome {
    return { request, status: 'completed' };
}

const PLOT: SkillFarmPlot = {
    id: 'plot-1',
    bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 65, z: 0 } },
};

const CROPS: readonly SkillBlock[] = [
    { position: { x: 0, y: 64, z: 0 }, name: 'wheat', properties: { age: '7' } },
    { position: { x: 1, y: 64, z: 0 }, name: 'wheat', properties: { age: '3' } },
    { position: { x: 2, y: 64, z: 0 }, name: 'carrots', properties: { age: '7' } },
];

describe('harvest-farm skill', () => {
    it('breaks and collects mature crops while skipping immature crops', () => {
        const world = new FakeWorld(CROPS);
        const skill = new HarvestFarmSkill();
        const input = { plot: PLOT };
        const [canRun, canRunError] = skill.canRun(context(world), input);
        expect(canRunError).toBeNull();
        expect(canRun).toBe(true);

        const [started] = skill.start(context(world), input);
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        expect(started.action).toEqual({
            kind: 'break-block',
            position: { x: 0, y: 64, z: 0 },
            expectedBlockId: 'wheat',
        });

        const actionKinds: string[] = [started.action.kind];
        let step: SkillStep | null = started;
        while (step?.status === 'running') {
            const [next, stepError] = skill.step(
                context(world, completed(step.action as ActionRequest)),
                step.run,
            );
            expect(stepError).toBeNull();
            if (next !== null && next.action !== null) actionKinds.push(next.action.kind);
            step = next;
        }
        expect(actionKinds).toEqual([
            'break-block',
            'collect-drops',
            'break-block',
            'collect-drops',
        ]);
        expect(step?.status).toBe('completed');
        expect(step?.run.state.harvested).toEqual(['0,64,0', '2,64,0']);
    });

    it('fails unsupported without a scan or plot source', () => {
        const skill = new HarvestFarmSkill();
        const [noScan, noScanError] = skill.canRun(context(new NoScanWorld()), { plot: PLOT });
        expect(noScanError).toBeNull();
        expect(noScan).toBe(false);
        const [unsupported] = skill.start(context(new NoScanWorld()), { plot: PLOT });
        expect(unsupported?.status).toBe('failed');
        expect(unsupported?.failure?.class).toBe('unsupported');

        const [noPlot, noPlotError] = skill.canRun(context(new FakeWorld()), {});
        expect(noPlotError).toBeNull();
        expect(noPlot).toBe(false);
        const [unsupportedPlot] = skill.start(context(new FakeWorld()), {});
        expect(unsupportedPlot?.status).toBe('failed');
        expect(unsupportedPlot?.failure?.class).toBe('unsupported');
    });

    it('checkpoints remaining crops and harvested keys', () => {
        const world = new FakeWorld(CROPS);
        const skill = new HarvestFarmSkill();
        const initialState = context(world);
        const [started] = skill.start(initialState, { plot: PLOT });
        if (started === null || started.action === null) {
            expect(started).not.toBeNull();
            return;
        }
        const [collecting] = skill.step(context(world, completed(started.action)), started.run);
        if (collecting === null) {
            expect(collecting).not.toBeNull();
            return;
        }
        expect(collecting.action).toMatchObject({ kind: 'collect-drops' });

        const [checkpoint, checkpointError] = skill.checkpoint(initialState, collecting.run);
        expect(checkpointError).toBeNull();
        if (checkpoint === null) {
            expect(checkpoint).not.toBeNull();
            return;
        }
        expect(checkpoint.state.harvested).toEqual([]);
        expect(checkpoint.state.remaining).toHaveLength(2);
        expect(checkpoint.state.activeKey).toBe('0,64,0');

        const [restored, restoreError] = skill.restore(initialState, checkpoint);
        expect(restoreError).toBeNull();
        if (restored === null) {
            expect(restored).not.toBeNull();
            return;
        }
        const [resumed] = skill.step(context(world), restored);
        expect(resumed?.action).toMatchObject({ kind: 'collect-drops' });
        if (resumed === null || resumed.action === null) return;
        const [next] = skill.step(context(world, completed(resumed.action)), resumed.run);
        expect(next?.action).toMatchObject({
            kind: 'break-block',
            position: { x: 2, y: 64, z: 0 },
        });
        expect(next?.run.state.harvested).toEqual(['0,64,0']);
    });
});

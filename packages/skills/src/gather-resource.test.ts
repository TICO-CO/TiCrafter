import type { ActionOutcome, Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { GatherResourceSkill } from './gather-resource.js';
import type { SkillContext, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    readonly blocks = new Map<string, string>();

    blockAt(position: Vec3): string | null {
        return this.blocks.get(this.key(position)) ?? 'air';
    }

    nearestContainer(): null {
        return null;
    }

    nearestBlock(names: readonly string[], maxDistance: number): Vec3 | null {
        const origin = { x: 0, y: 64, z: 0 };
        for (const [key, name] of this.blocks) {
            if (!names.includes(name)) continue;
            const [xText, yText, zText] = key.split(',');
            if (xText === undefined || yText === undefined || zText === undefined) continue;
            const x = Number(xText);
            const y = Number(yText);
            const z = Number(zText);
            if (Math.hypot(x - origin.x, y - origin.y, z - origin.z) <= maxDistance) {
                return { x, y, z };
            }
        }
        return null;
    }

    remove(position: Vec3): void {
        this.blocks.delete(this.key(position));
    }

    private key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

function context(world: FakeWorld, lastAction: ActionOutcome | null = null): SkillContext {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-13T00:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [],
        world,
        hostiles: [],
        nearestHostile: null,
        lastAction,
    };
}

function completed(target: Vec3): ActionOutcome {
    return { request: { kind: 'break-block', position: target }, status: 'completed' };
}

describe('gather resource', () => {
    it('mines multiple matching blocks and collects drops', () => {
        const world = new FakeWorld();
        world.blocks.set('1,64,0', 'oak_log');
        world.blocks.set('2,64,0', 'oak_log');
        const skill = new GatherResourceSkill();
        const [started, startError] = skill.start(context(world), {
            count: 2,
            blockIds: ['oak_log'],
        });
        expect(startError).toBeNull();
        expect(started?.action).toEqual({
            kind: 'break-block',
            position: { x: 1, y: 64, z: 0 },
            expectedBlockId: 'oak_log',
        });
        if (started === null) return;
        world.remove({ x: 1, y: 64, z: 0 });
        const [collecting] = skill.step(
            context(world, completed({ x: 1, y: 64, z: 0 })),
            started.run,
        );
        expect(collecting?.action?.kind).toBe('collect-drops');
        if (collecting === null) return;
        const [next] = skill.step(context(world, completed({ x: 1, y: 64, z: 0 })), collecting.run);
        expect(next?.action).toEqual({
            kind: 'break-block',
            position: { x: 2, y: 64, z: 0 },
            expectedBlockId: 'oak_log',
        });
    });

    it('fails when no matching block is nearby', () => {
        const skill = new GatherResourceSkill();
        const [step, error] = skill.start(context(new FakeWorld()), {
            count: 1,
            blockIds: ['oak_log'],
        });
        expect(error).toBeNull();
        expect(step?.status).toBe('failed');
        expect(step?.failure?.class).toBe('target-missing');
    });

    it('restores a valid checkpoint', () => {
        const skill = new GatherResourceSkill();
        const [run, error] = skill.restore(context(new FakeWorld()), {
            botId: 'bot.tibot1',
            taskId: 'goal-1',
            skillId: 'gather-resource',
            state: {
                blockIds: ['oak_log'],
                remaining: 1,
                mined: 0,
                radius: 16,
                target: null,
                phase: 'break',
            },
            updatedAt: '2026-11-13T00:00:00.000Z',
        });
        expect(error).toBeNull();
        expect(run?.skillId).toBe('gather-resource');
    });

    it('rejects a checkpoint without block ids', () => {
        const skill = new GatherResourceSkill();
        const [, error] = skill.restore(context(new FakeWorld()), {
            botId: 'bot.tibot1',
            taskId: 'goal-1',
            skillId: 'gather-resource',
            state: { remaining: 1 },
            updatedAt: '2026-11-13T00:00:00.000Z',
        });
        expect(error).not.toBeNull();
    });
});

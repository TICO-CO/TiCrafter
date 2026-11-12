import type { ActionRequest, Result } from '@ticrafter/core';
import type { SafetyDecision, SafetySnapshot } from '@ticrafter/safety';
import type { SkillConstructionOperation, SkillContext } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import { BuildingExecutionService } from './building-execution-service.js';
import { WorldCacheAdapter } from './world-cache.js';

interface FakeBlock {
    name: string;
    getProperties: () => Record<string, string>;
    boundingBox: string;
}

class FakeWorldBot {
    readonly blocks = new Map<string, FakeBlock>();

    set(position: { x: number; y: number; z: number }, name: string): void {
        this.blocks.set(`${position.x},${position.y},${position.z}`, {
            name,
            getProperties: () => ({}),
            boundingBox: 'block',
        });
    }

    blockAt(position: Vec3): FakeBlock | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? null;
    }
}

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const snapshot: SafetySnapshot = {
    botId: 'bot.builder',
    at: '2026-11-12T12:00:00.000Z',
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    food: 20,
    oxygen: 20,
    onGround: true,
    stuckMilliseconds: 0,
    targetUnreachableMilliseconds: 0,
    inventory: [],
    inventoryUsedSlots: 0,
    inventoryTotalSlots: 36,
    hostiles: [],
    activeSkillId: null,
    claimTrackingEnabled: true,
    allowDestructiveMaterials: false,
    world: {
        blockAt: () => null,
        isProtected: () => false,
        activeBots: () => [],
        claimFor: () => null,
    },
};

function context(): SkillContext {
    return {
        botId: 'bot.builder',
        at: '2026-11-12T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [],
        world: new WorldCacheAdapter(null as unknown as Bot),
        hostiles: [],
        nearestHostile: null,
        lastAction: null,
    };
}

function operation(claimId?: string): SkillConstructionOperation {
    return {
        kind: 'place',
        target: {
            position: { x: 0, y: 64, z: 0 },
            itemName: 'stone',
            expectedBlockId: 'stone',
        },
        blueprintId: 'blueprint.home',
        blueprintRevision: 1,
        workPackageId: 'package.walls',
        structureId: 'structure.home',
        phase: 'walls',
        ...(claimId === undefined ? {} : { claimId }),
    };
}

function createService(bot: FakeWorldBot): BuildingExecutionService {
    const world = new WorldCacheAdapter(bot as unknown as Bot);
    return new BuildingExecutionService({
        world,
        snapshot: () => [snapshot, null],
        safety: {
            evaluate: (): SafetyDecision => ({ allowed: true, signals: [] }),
        },
    });
}

describe('BuildingExecutionService', () => {
    it('prepares a journaled action and completes it', () => {
        const bot = new FakeWorldBot();
        const service = createService(bot);
        const [prepared, prepareError] = service.prepare(context(), operation());

        expect(prepareError).toBeNull();
        expect(prepared?.status).toBe('ready');
        expect(prepared?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 0, y: 64, z: 0 },
            expectedBlockId: 'stone',
        });
        expect(service.changelog[0]).toMatchObject({
            blueprintId: 'blueprint.home',
            blueprintRevision: 1,
            workPackageId: 'package.walls',
            structureId: 'structure.home',
            phase: 'walls',
        });

        bot.set({ x: 0, y: 64, z: 0 }, 'stone');
        const action = prepared?.action as ActionRequest;
        const [completed, completeError] = service.complete(context(), operation(), {
            request: action,
            status: 'completed',
        });
        expect(completeError).toBeNull();
        expect(completed === undefined).toBe(true);
    });

    it('skips blocks that are already satisfied', () => {
        const bot = new FakeWorldBot();
        bot.set({ x: 0, y: 64, z: 0 }, 'stone');
        const service = createService(bot);

        const [prepared, prepareError] = service.prepare(context(), operation());
        expect(prepareError).toBeNull();
        expect(prepared).toEqual({ status: 'skipped', action: null });
    });

    it('rejects claim operations without a fencing token', () => {
        const bot = new FakeWorldBot();
        const service = createService(bot);
        const [prepared, prepareError] = service.prepare(context(), operation('claim-1'));

        expect(prepared).toBeNull();
        expect(prepareError).toBe('claim fencing token is required');
    });
});

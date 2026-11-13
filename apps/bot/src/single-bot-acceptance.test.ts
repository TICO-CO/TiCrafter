import {
    type ConstructionPlan,
    ConstructionPlanDocumentHash,
    type ContainerView,
    type ProcurementCatalogPort,
} from '@ticrafter/building';
import type {
    ActionOutcome,
    ActionRequest,
    ConstructionPlanDocumentPayload,
    Envelope,
    Result,
    TransportFailure,
} from '@ticrafter/core';
import type { SafetyDecision, SafetySnapshot } from '@ticrafter/safety';
import type { SkillConstructionPlan, SkillContext, SkillInput } from '@ticrafter/skills';
import { ConstructionSkill } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import { BuildingExecutionService } from './building-execution-service.js';
import { BuildingProcurementService } from './building-procurement-service.js';
import type { BuildingWorldView } from './building-services.js';
import { ConstructionPlanFetchClient } from './construction-plan-fetch-client.js';
import { ConstructionSource } from './construction-source.js';
import { WorldCacheAdapter } from './world-cache.js';

interface FakeBlock {
    name: string;
    getProperties: () => Record<string, string>;
    boundingBox: string;
}

class FakeWorldBot {
    readonly blocks = new Map<string, FakeBlock>();

    set(position: { x: number; y: number; z: number }, name: string): void {
        this.blocks.set(FakeWorldBot.key(position), {
            name,
            getProperties: () => ({}),
            boundingBox: 'block',
        });
    }

    remove(position: { x: number; y: number; z: number }): void {
        this.blocks.delete(FakeWorldBot.key(position));
    }

    blockAt(position: Vec3): FakeBlock | null {
        return this.blocks.get(FakeWorldBot.key(position)) ?? null;
    }

    private static key(position: { x: number; y: number; z: number }): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

class FakeWorldView implements BuildingWorldView {
    constructor(private readonly bot: FakeWorldBot) {}

    blockStateAt(position: { x: number; y: number; z: number }) {
        const block = this.bot.blocks.get(`${position.x},${position.y},${position.z}`);
        if (block === undefined) {
            if (position.y <= 63) return { name: 'stone', properties: {} };
            return null;
        }
        return { name: block.name, properties: block.getProperties() };
    }

    blocksInBox(bbox: {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    }) {
        const blocks = [];
        for (let x = bbox.min.x; x <= bbox.max.x; x += 1) {
            for (let z = bbox.min.z; z <= bbox.max.z; z += 1) {
                const height = 63;
                for (let y = bbox.min.y; y <= Math.min(bbox.max.y, height); y += 1) {
                    blocks.push({ name: 'stone', position: { x, y, z }, properties: {} });
                }
            }
        }
        for (const [key, block] of this.bot.blocks) {
            const [x, y, z] = key.split(',').map(Number);
            if (
                x === undefined ||
                y === undefined ||
                z === undefined ||
                x < bbox.min.x ||
                x > bbox.max.x ||
                y < bbox.min.y ||
                y > bbox.max.y ||
                z < bbox.min.z ||
                z > bbox.max.z
            ) {
                continue;
            }
            blocks.push({ name: block.name, position: { x, y, z }, properties: {} });
        }
        return blocks;
    }
}

class FakeTransport {
    response: Envelope | null = null;

    async request(_type: string, _payload: unknown): Promise<Result<Envelope, TransportFailure>> {
        return [this.response, null];
    }
}

class FakeCatalog implements ProcurementCatalogPort {
    recipeFor(item: string): Result<readonly { item: string; count: number }[] | null, never> {
        if (item === 'stone') return [[{ item: 'cobblestone', count: 2 }], null];
        return [null, null];
    }

    sourceFor(item: string): Result<string | null, never> {
        if (item === 'dirt') return ['dirt', null];
        return [null, null];
    }
}

class FakeContainers {
    constructor(readonly containers: ContainerView[]) {}

    list(): readonly ContainerView[] {
        return this.containers;
    }
}

const SNAPSHOT: SafetySnapshot = {
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
    activeSkillId: 'construction',
    claimTrackingEnabled: true,
    allowDestructiveMaterials: false,
    world: {
        blockAt: () => null,
        isProtected: () => false,
        activeBots: () => [],
        claimFor: () => null,
        claims: () => [],
        grants: () => [],
    },
};

function plan(): ConstructionPlan {
    return {
        id: 'plan.acceptance',
        blueprintId: 'blueprint.acceptance',
        anchor: { x: 0, y: 64, z: 0 },
        rotation: 0,
        translation: { x: 0, y: 64, z: 0 },
        site: {
            anchor: { x: 0, y: 64, z: 0 },
            translation: { x: 0, y: 64, z: 0 },
            rotation: 0,
            bounds: { min: { x: 0, y: 64, z: 0 }, max: { x: 1, y: 65, z: 0 } },
            clearance: [],
            access: { kind: 'none', from: null, to: { x: 0, y: 64, z: 0 }, length: 0 },
            foundationMode: 'level',
            foundationFillDepth: 0,
            foundationCutDepth: 0,
            score: 100,
            rationale: [],
        },
        foundation: {
            mode: 'level',
            targetY: 64,
            maximumFillDepth: 0,
            changes: [],
            materials: [],
            rationale: [],
        },
        changes: [
            {
                kind: 'place',
                block: { x: 0, y: 64, z: 0, state: { name: 'oak_planks' }, priority: 1 },
                phase: 'walls',
                reason: 'blueprint',
                dependsOn: [],
            },
            {
                kind: 'place',
                block: { x: 1, y: 64, z: 0, state: { name: 'oak_planks' }, priority: 1 },
                phase: 'walls',
                reason: 'blueprint',
                dependsOn: [],
            },
        ],
        order: ['0,64,0', '1,64,0'],
        dependencies: [],
        scaffolds: [],
        unreachable: [],
        phases: ['walls'],
        materials: [{ item: 'oak_planks', count: 2 }],
        workPackages: [
            {
                id: 'plan.acceptance:layers:walls:0',
                bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 1, y: 64, z: 0 } },
                blockKeys: ['0,64,0', '1,64,0'],
                strategy: 'layers',
                status: 'planned',
                phase: 'walls',
                materials: [{ item: 'oak_planks', count: 2 }],
                scaffoldPositions: [],
                predecessorIds: [],
            },
        ],
    };
}

function scaffoldPlan(): ConstructionPlan {
    const base = plan();
    return {
        ...base,
        scaffolds: [
            {
                position: { x: 0, y: 64, z: 0 },
                stateName: 'dirt',
                targetKeys: [],
                removalPhase: 'scaffold-removal',
            },
            {
                position: { x: 0, y: 66, z: 0 },
                stateName: 'dirt',
                targetKeys: [],
                removalPhase: 'scaffold-removal',
            },
            {
                position: { x: 0, y: 65, z: 0 },
                stateName: 'dirt',
                targetKeys: [],
                removalPhase: 'scaffold-removal',
            },
        ],
    };
}

function response(planDocument: ConstructionPlanDocumentPayload): Envelope {
    return {
        v: 1,
        id: 'response-1',
        kind: 'response',
        type: 'bot.constructionPlan.response',
        payload: { ok: true, document: planDocument },
        timestamp: '2026-11-12T12:00:00.000Z',
    };
}

async function loadPlan(
    sourcePlan: ConstructionPlan,
    revision = 1,
): Promise<{ plans: ConstructionPlanFetchClient; transport: FakeTransport }> {
    const content = {
        id: sourcePlan.id,
        revision,
        structureId: 'structure.acceptance',
        blueprintId: sourcePlan.blueprintId,
        blueprintRevision: 1,
        purpose: 'build' as const,
        plan: sourcePlan,
        createdAt: '2026-11-12T12:00:00.000Z',
    };
    const document = {
        ...content,
        hash: ConstructionPlanDocumentHash.of(content),
    } satisfies ConstructionPlanDocumentPayload;
    const transport = new FakeTransport();
    transport.response = response(document);
    const plans = new ConstructionPlanFetchClient(transport, 'bot.builder');
    await plans.fetch(sourcePlan.id, revision);
    return { plans, transport };
}

function executionService(bot: FakeWorldBot, safety = { allowed: true }): BuildingExecutionService {
    let now = 0;
    return new BuildingExecutionService({
        world: new WorldCacheAdapter(bot as unknown as Bot),
        snapshot: () => [SNAPSHOT, null],
        clock: { now: () => (now += 1000) },
        safety: {
            evaluate: (): SafetyDecision =>
                safety.allowed
                    ? { allowed: true, signals: [] }
                    : {
                          allowed: false,
                          reason: 'acceptance veto',
                          signals: [],
                          recovery: { kind: 'retry-local', reason: 'acceptance veto' },
                      },
        },
    });
}

function context(
    bot: FakeWorldBot,
    services: {
        construction: ConstructionSource;
        buildExecution: BuildingExecutionService;
    },
    inventory: readonly { name: string; count: number }[] = [{ name: 'oak_planks', count: 2 }],
): SkillContext {
    const world = new WorldCacheAdapter(bot as unknown as Bot);
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

function input(sourcePlan: ConstructionPlan): SkillInput {
    return {
        blueprintId: sourcePlan.blueprintId,
        blueprintRevision: 1,
        planId: sourcePlan.id,
        planRevision: 1,
        workPackageId: sourcePlan.workPackages[0]?.id ?? `${sourcePlan.id}:cleanup`,
        structureId: 'structure.acceptance',
        claimId: 'claim.acceptance',
        fencingToken: 1,
    };
}

function applyAction(bot: FakeWorldBot, action: ActionRequest): ActionOutcome {
    if (action.kind === 'place-block') {
        bot.set(action.position, action.itemName);
    } else if (action.kind === 'break-block') {
        bot.remove(action.position);
    }
    return { request: action, status: 'completed' };
}

describe('single-bot construction acceptance', () => {
    it('restores a checkpoint by re-diffing the world', async () => {
        const bot = new FakeWorldBot();
        const sourcePlan = plan();
        const { plans } = await loadPlan(sourcePlan);
        const source = new ConstructionSource({ plans, world: new FakeWorldView(bot) });
        const execution = executionService(bot);
        const skill = new ConstructionSkill();
        const services = { construction: source, buildExecution: execution };
        const initial = context(bot, services);

        const [started, startError] = skill.start(initial, input(sourcePlan));
        expect(startError).toBeNull();
        expect(started?.status).toBe('running');
        const firstAction = started?.action;
        expect(firstAction).not.toBeNull();
        if (started === null || firstAction === null || firstAction === undefined) return;

        const [next, stepError] = skill.step(
            { ...initial, lastAction: applyAction(bot, firstAction) },
            started.run,
        );
        expect(stepError).toBeNull();
        expect(next?.status).toBe('running');
        if (next === null) return;
        const [checkpoint, checkpointError] = skill.checkpoint(initial, next.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint).not.toBeNull();
        if (checkpoint === null) return;

        const restoredExecution = executionService(bot);
        const restoredServices = {
            construction: source,
            buildExecution: restoredExecution,
        };
        const restoredContext = context(bot, restoredServices);
        const [restored, restoreError] = skill.restore(restoredContext, checkpoint);
        expect(restoreError).toBeNull();
        expect(restored).not.toBeNull();
        if (restored === null) return;

        const [resumed] = skill.step(restoredContext, restored);
        expect(resumed?.status).toBe('running');
        const resumedAction = resumed?.action;
        expect(resumedAction).not.toBeNull();
        if (resumed === null || resumedAction === null || resumedAction === undefined) return;
        expect(resumedAction.kind).toBe('place-block');
        if (resumedAction.kind !== 'place-block') return;
        expect(resumedAction.position).toEqual({ x: 1, y: 64, z: 0 });

        const [completed] = skill.step(
            { ...restoredContext, lastAction: applyAction(bot, resumedAction) },
            resumed.run,
        );
        expect(completed?.status).toBe('completed');
        expect(bot.blocks.has('0,64,0')).toBe(true);
        expect(bot.blocks.has('1,64,0')).toBe(true);
        expect(restoredExecution.changelog).toHaveLength(1);
        expect(restoredExecution.changelog[0]?.phase).toBe('walls');
        expect(restoredExecution.changelog[0]?.workPackageId).toBe(sourcePlan.workPackages[0]?.id);
        expect(restoredExecution.changelog[0]?.structureId).toBe('structure.acceptance');
        expect(restoredExecution.changelog[0]).toMatchObject({
            structureId: 'structure.acceptance',
            blueprintId: sourcePlan.blueprintId,
            blueprintRevision: 1,
            workPackageId: sourcePlan.workPackages[0]?.id,
            planId: sourcePlan.id,
            fencingToken: 1,
            phase: 'walls',
        });
    });

    it('fails closed on missing materials and resumes after procurement', async () => {
        const bot = new FakeWorldBot();
        const sourcePlan = plan();
        const { plans } = await loadPlan(sourcePlan);
        const source = new ConstructionSource({ plans, world: new FakeWorldView(bot) });
        const skill = new ConstructionSkill();
        const services = {
            construction: source,
            buildExecution: executionService(bot),
        };

        const [missing] = skill.start(context(bot, services, []), input(sourcePlan));
        expect(missing?.status).toBe('failed');
        expect(missing?.failure?.class).toBe('missing-item');

        const containers = new FakeContainers([
            {
                id: 'container.chest',
                position: { x: 4, y: 64, z: 0 },
                role: 'storage',
                contents: [{ itemId: 'oak_planks', count: 2 }],
            },
        ]);
        const procurement = new BuildingProcurementService(containers, new FakeCatalog());
        const [procurementPlan, procurementError] = procurement.plan({
            needs: [
                { item: 'oak_planks', count: 2 },
                { item: 'stone', count: 1 },
                { item: 'dirt', count: 1 },
            ],
            inventory: [],
            position: { x: 0, y: 64, z: 0 },
        });
        expect(procurementError).toBeNull();
        expect(procurementPlan?.actions.map((action) => action.kind)).toEqual([
            'withdraw',
            'gather',
            'craft',
        ]);

        const [started, startError] = skill.start(
            context(bot, services, [{ name: 'oak_planks', count: 2 }]),
            input(sourcePlan),
        );
        expect(startError).toBeNull();
        expect(started?.status).toBe('running');
    });

    it('removes scaffold packages top-down', async () => {
        const bot = new FakeWorldBot();
        const sourcePlan = scaffoldPlan();
        const { plans } = await loadPlan(sourcePlan);
        const source = new ConstructionSource({ plans, world: new FakeWorldView(bot) });

        const [resolved, resolveError] = source.resolve(
            context(bot, {
                construction: source,
                buildExecution: executionService(bot),
            }),
            {
                planId: sourcePlan.id,
                planRevision: 1,
                workPackageId: `${sourcePlan.id}:cleanup`,
            },
        );
        expect(resolveError).toBeNull();
        expect(resolved).not.toBeNull();
        const cleanup = resolved as SkillConstructionPlan;
        expect(cleanup.operations.map((operation) => operation.kind)).toEqual([
            'break',
            'break',
            'break',
        ]);
        expect(cleanup.operations.map((operation) => operation.target.position.y)).toEqual([
            66, 65, 64,
        ]);
    });
});

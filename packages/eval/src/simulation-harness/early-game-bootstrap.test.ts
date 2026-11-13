import {
    type GoalStep,
    ProgressionPlanModel,
    ProgressionPlanner,
    StaticRecipePort,
} from '@ticrafter/agency';
import type { Vec3 } from '@ticrafter/core';
import {
    EffectsEmitter,
    SkillCatalog,
    type SkillContext,
    SkillLifecycleExecutor as Executor,
    type SkillLifecycleExecutor,
    SkillRegistry,
} from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { FakeActionDispatcher } from './fake-action-dispatcher.js';
import { FakeContainers } from './fake-containers.js';
import { FakeInventory } from './fake-inventory.js';
import { FakeWorld } from './fake-world.js';
import { SimulationClock } from './simulation-clock.js';

const HOME: Vec3 = { x: 0, y: 62, z: 0 };
const HOME_BBOX = {
    min: { x: -1, y: 61, z: -1 },
    max: { x: 1, y: 65, z: 1 },
};

const RECIPES = {
    oak_planks: { oak_log: 1 },
    stick: { oak_planks: 2 },
    crafting_table: { oak_planks: 4 },
    wooden_pickaxe: { oak_planks: 3, stick: 2 },
    wooden_sword: { oak_planks: 2, stick: 1 },
    stone_pickaxe: { cobblestone: 3, stick: 2 },
    stone_sword: { cobblestone: 2, stick: 1 },
    furnace: { cobblestone: 8 },
    chest: { oak_planks: 8 },
    red_bed: { oak_planks: 3, white_wool: 3 },
};

const OUTPUTS = {};

function bootstrapWorld(): FakeWorld {
    const world = new FakeWorld({
        seed: 42,
        kind: 'flat',
        min: { x: -8, y: 55, z: -8 },
        max: { x: 8, y: 70, z: 8 },
        groundY: 60,
        clearRegion: {
            min: { x: -4, y: 55, z: -4 },
            max: { x: 4, y: 70, z: 4 },
        },
        entities: [{ id: 1, name: 'sheep', position: { x: 2, y: 61, z: 2 } }],
    });
    for (let index = 0; index < 32; index += 1) {
        world.applyBlock(
            { x: 3 + (index % 4), y: 61, z: Math.floor(index / 4) },
            { name: 'oak_log', properties: {} },
        );
    }
    for (let index = 0; index < 32; index += 1) {
        world.applyBlock(
            { x: -3, y: 61 + (index % 4), z: -4 + Math.floor(index / 4) },
            { name: 'stone', properties: {} },
        );
    }
    return world;
}

function snapshot(
    world: FakeWorld,
    inventory: FakeInventory,
    position: Vec3,
    overrides: Record<string, unknown> = {},
) {
    const homeBlocks = world.blocksInBox(HOME_BBOX);
    const hasBedAtHome = homeBlocks.some((block) => block.name.endsWith('_bed'));
    const roof = homeBlocks.some((block) => block.position.y >= HOME_BBOX.min.y + 2);
    const walls = homeBlocks.filter(
        (block) =>
            block.position.y === HOME_BBOX.min.y + 1 &&
            (block.position.x === HOME_BBOX.min.x ||
                block.position.x === HOME_BBOX.max.x ||
                block.position.z === HOME_BBOX.min.z ||
                block.position.z === HOME_BBOX.max.z),
    ).length;
    return {
        at: '2026-11-13T00:00:00.000Z',
        position,
        health: 20,
        food: 20,
        timeOfDay: 1000,
        inventory: inventory.items(),
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: HOME,
        hasBed: hasBedAtHome,
        knownResourceSites: [
            ...(world.nearestBlock(['oak_log'], 32) === null
                ? []
                : [
                      {
                          kind: 'wood',
                          position: world.nearestBlock(['oak_log'], 32) as Vec3,
                      },
                  ]),
            ...(world.nearestBlock(['stone'], 32) === null
                ? []
                : [
                      {
                          kind: 'stone',
                          position: world.nearestBlock(['stone'], 32) as Vec3,
                      },
                  ]),
        ],
        homeBbox: HOME_BBOX,
        homeStatus: 'active' as const,
        homeStructureId: 'structure.home',
        hasBedAtHome,
        isSheltered: roof && walls >= 4,
        digSite: null,
        weapon: null,
        armorPieces: 0,
        armorInventoryPieces: 0,
        nightIntent: null,
        hasCraftingTable: world
            .blocksInBox(HOME_BBOX)
            .some((block) => block.name === 'crafting_table'),
        ...overrides,
    };
}

function context(
    world: FakeWorld,
    inventory: FakeInventory,
    position: Vec3,
    lastAction: SkillContext['lastAction'] = null,
): SkillContext {
    return {
        botId: 'bot.bootstrap',
        at: '2026-11-13T00:00:00.000Z',
        position,
        health: 20,
        food: 20,
        inventory: inventory.items(),
        world,
        hostiles: [],
        nearestHostile: null,
        lastAction,
    };
}

describe('early-game bootstrap', () => {
    it('runs empty inventory through progression without planner or seed jobs', () => {
        const world = bootstrapWorld();
        const inventory = new FakeInventory();
        const clock = new SimulationClock(0);
        let position: Vec3 = { x: 0, y: 61, z: 0 };
        const dispatcher = new FakeActionDispatcher({
            clock,
            world,
            inventory,
            containers: new FakeContainers(),
            position: () => position,
            setPosition: (next) => {
                position = next;
            },
            recipes: RECIPES,
            outputs: OUTPUTS,
            drops: { stone: 'cobblestone' },
        });
        const [catalog, catalogError] = SkillCatalog.createRegistry();
        expect(catalogError).toBeNull();
        const lifecycle = new Executor({
            registry: catalog ?? new SkillRegistry(),
            dispatch: dispatcher,
            effects: new EffectsEmitter(),
        });
        const planner = new ProgressionPlanner(new StaticRecipePort());
        let plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        const completed: string[] = [];

        for (let guard = 0; guard < 12; guard += 1) {
            const [decision, decisionError] = planner.nextGoal(
                plan,
                snapshot(world, inventory, position),
            );
            expect(decisionError).toBeNull();
            if (decision === null || decision.goal === null) break;
            plan = decision.plan;
            for (const step of decision.goal.steps) {
                runStep(lifecycle, step, world, inventory, () => position);
            }
            completed.push(decision.goal.id);
            plan = planner.observe(plan, {
                goal: decision.goal,
                status: 'completed',
                at: '2026-11-13T00:00:01.000Z',
            });
        }

        expect(completed).toEqual([
            'goal:progression:forage-wood',
            'goal:progression:crafting-table',
            'goal:progression:wooden-tools',
            'goal:progression:stone-tools',
            'goal:progression:furnace-chest',
            'goal:progression:base-provisioning',
        ]);
        expect(plan.milestoneIndex).toBe(plan.milestones.length);
        expect(inventory.items().some((item) => item.name === 'stone_pickaxe')).toBe(true);
        expect(inventory.items().some((item) => item.name === 'stone_sword')).toBe(true);
        expect(inventory.items().some((item) => item.name === 'furnace')).toBe(true);
        expect(inventory.items().some((item) => item.name === 'chest')).toBe(true);
        expect(world.blocksInBox(HOME_BBOX).some((block) => block.name === 'red_bed')).toBe(true);
    });
});

function runStep(
    lifecycle: SkillLifecycleExecutor,
    step: GoalStep,
    world: FakeWorld,
    inventory: FakeInventory,
    position: () => Vec3,
): void {
    const [started, startError] = lifecycle.start(
        step.skillId,
        step.input,
        context(world, inventory, position()),
    );
    expect(startError).toBeNull();
    let current = started;
    for (let guard = 0; guard < 240 && current?.status === 'running'; guard += 1) {
        const [next, advanceError] = lifecycle.advance(context(world, inventory, position()));
        expect(advanceError).toBeNull();
        current = next;
    }
    expect({ status: current?.status, failure: current?.failure }).toEqual({
        status: 'completed',
        failure: null,
    });
}

import type { BenchmarkFixtureKind, BenchmarkQuestions, LayaBenchmarkFixture } from './types.js';

const standardAffordances = {
    chopOak: 'Chop the nearby oak tree for wood',
    mineStone: 'Mine exposed stone in the shallow pit',
    craftPickaxe: 'Craft a stone pickaxe at the crafting table',
    smeltIron: 'Smelt raw iron in the base furnace',
    depositInventory: 'Deposit surplus logs and cobblestone in storage',
    eatFood: 'Eat cooked beef to restore hunger',
    fleeZombie: 'Retreat from the zombie approaching the north wall',
    repairBridge: 'Repair the broken planks on the east bridge',
    plantWheat: 'Plant wheat seeds in the irrigated farm plot',
    exploreCave: 'Explore the dark cave entrance below the ridge',
    collectWater: 'Collect water buckets from the pond',
    idleWatch: 'Stand watch near the base entrance',
} satisfies Record<string, string>;

const compactAffordances = {
    mineOak: 'Mine oak',
    mineStone: 'Mine stone',
    craftPickaxe: 'Craft pickaxe',
    depositItems: 'Deposit items',
    eatFood: 'Eat food',
    fleeZombie: 'Flee zombie',
    repairBridge: 'Repair bridge',
    plantWheat: 'Plant wheat',
} satisfies Record<string, string>;

const standardState: Record<string, unknown> = {
    self: {
        health: 18,
        food: 16,
        biome: 'plains',
        position: { x: 24, y: 68, z: -12 },
        timeOfDay: 'day',
    },
    target: 'oak tree near the north wall',
    inventory: ['oak_log x24', 'cobblestone x18', 'stone_pickaxe x1', 'bread x6', 'torch x12'],
    hazards: ['zombie 14 blocks north', 'cave darkness below the ridge'],
    nearby: ['crafting_table at 22,68,-14', 'chest at 20,68,-12', 'furnace at 21,68,-14'],
    currentSkill: {
        name: 'Mine',
        progress: 0.35,
        lastResult: 'blocked by flowing water',
    },
    task: {
        id: 'task-build-house-shell',
        title: 'Build the north wall of the house',
        progress: 0.42,
    },
};

const compactState: Record<string, unknown> = {
    self: { health: 18, food: 16, biome: 'plains', y: 68, timeOfDay: 'day' },
    target: 'oak tree',
    inventory: ['oak_log x24', 'cobblestone x18', 'stone_pickaxe x1', 'bread x6', 'torch x12'],
    hazards: ['zombie 14m north'],
    currentSkill: { name: 'Mine', progress: 0.35, lastResult: 'blocked by water' },
    task: { id: 'task-house-wall', progress: 0.42 },
};

export class BenchmarkFixture {
    static create(variant: BenchmarkFixtureKind): LayaBenchmarkFixture {
        const affordances = variant === 'compact' ? compactAffordances : standardAffordances;
        return {
            state: variant === 'compact' ? compactState : standardState,
            questions: BenchmarkFixture.questions(affordances),
            affordanceIds: Object.keys(affordances),
        };
    }

    private static questions(affordances: Record<string, string>): BenchmarkQuestions {
        return {
            nextAction: {
                type: 'choice',
                instructions: 'Choose the next action for the builder bot.',
                criteria: affordances,
            },
            danger: {
                type: 'noul',
                instructions: 'Is the bot about to take damage or die?',
            },
            shouldContinue: {
                type: 'noul',
                instructions: 'Is the current skill still making progress?',
            },
        };
    }
}

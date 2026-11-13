import type { ScenarioAssertion } from '../behavior-assertions/index.js';
import type { BehaviorScenario } from './scenario.js';

const HOUSE_ANCHOR = { x: 6, y: 68, z: 6 };

const BUILD_TASK = {
    id: 'task.simulated-build',
    title: 'Build a house on uneven terrain',
    skillId: 'schematic-build',
    requiredRole: null,
    payload: {
        schematic: {
            id: 'template:house',
            anchor: HOUSE_ANCHOR,
            revision: 0,
        },
    },
};

const BUILD_ASSERTIONS: readonly ScenarioAssertion[] = [
    {
        id: 'build-complete',
        kind: 'world.diff-empty',
        schematicId: 'template:house',
        anchor: HOUSE_ANCHOR,
        message: 'the final world must match the stored blueprint',
    },
    {
        id: 'no-duplicate-writes',
        kind: 'world.no-duplicate-writes',
        message: 'no block position may be written twice',
    },
    {
        id: 'task-completed',
        kind: 'task.status',
        taskId: 'task.simulated-build',
        status: 'completed',
        message: 'the construction task must complete',
    },
];

const BOOTSTRAP_HOME = {
    anchor: { x: 0, y: 60, z: 0 },
    bbox: { min: { x: -2, y: 59, z: -2 }, max: { x: 2, y: 65, z: 2 } },
    status: 'active' as const,
    structureId: 'structure.bootstrap-home',
};

const BOOTSTRAP_RECIPES = {
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

const BOOTSTRAP_ASSERTIONS: readonly ScenarioAssertion[] = [
    {
        id: 'crafting-table',
        kind: 'world.blocks-in-box',
        bbox: BOOTSTRAP_HOME.bbox,
        blockId: 'crafting_table',
        minimum: 1,
        message: 'bootstrap must place a crafting table',
    },
    {
        id: 'stone-pickaxe',
        kind: 'inventory.has',
        itemName: 'stone_pickaxe',
        minimum: 1,
        message: 'bootstrap must craft a stone pickaxe',
    },
    {
        id: 'stone-sword',
        kind: 'inventory.has',
        itemName: 'stone_sword',
        minimum: 1,
        message: 'bootstrap must craft a stone sword',
    },
    {
        id: 'furnace',
        kind: 'inventory.has',
        itemName: 'furnace',
        minimum: 1,
        message: 'bootstrap must craft a furnace',
    },
    {
        id: 'chest',
        kind: 'inventory.has',
        itemName: 'chest',
        minimum: 1,
        message: 'bootstrap must craft a chest',
    },
    {
        id: 'bed-at-home',
        kind: 'world.blocks-in-box',
        bbox: BOOTSTRAP_HOME.bbox,
        blockId: 'red_bed',
        minimum: 1,
        message: 'bootstrap must place a bed at home',
    },
];

const FARM_HOME = {
    anchor: { x: -10, y: 59, z: -10 },
    bbox: { min: { x: -12, y: 58, z: -12 }, max: { x: -8, y: 64, z: -8 } },
    status: 'active' as const,
    structureId: 'structure.village-home',
};

function farmPlotBBox(x: number, z: number) {
    return {
        min: { x, y: 58, z },
        max: { x: x + 2, y: 60, z: z + 2 },
    };
}

function farmPlotId(x: number, z: number): string {
    return `farm.${x}.59.${z}`;
}

function farmBlocks(): NonNullable<BehaviorScenario['world']['blocks']>[number][] {
    const blocks: NonNullable<BehaviorScenario['world']['blocks']>[number][] = [];
    for (const [x, z] of [
        [0, 0],
        [6, 0],
        [12, 0],
        [0, 8],
        [6, 8],
        [12, 8],
        [0, 16],
        [6, 16],
    ] as const) {
        for (let dx = 0; dx < 3; dx += 1) {
            for (let dz = 0; dz < 3; dz += 1) {
                blocks.push({
                    position: { x: x + dx, y: 59, z: z + dz },
                    name: 'farmland',
                    properties: { moisture: '7' },
                });
                blocks.push({
                    position: { x: x + dx, y: 60, z: z + dz },
                    name: 'wheat',
                    properties: { age: '7' },
                });
            }
        }
    }
    return blocks;
}

const VILLAGE_FARM_CLAIMS = [
    {
        id: 'claim.self',
        ownerBotId: 'bot.tibot1',
        resourceType: 'farm_plot' as const,
        bbox: farmPlotBBox(0, 0),
    },
    {
        id: 'claim.other',
        ownerBotId: 'bot.other',
        resourceType: 'farm_plot' as const,
        bbox: farmPlotBBox(6, 0),
    },
    {
        id: 'claim.ambiguous.one',
        ownerBotId: 'bot.one',
        resourceType: 'farm_plot' as const,
        bbox: farmPlotBBox(0, 16),
    },
    {
        id: 'claim.ambiguous.two',
        ownerBotId: 'bot.two',
        resourceType: 'farm_plot' as const,
        bbox: farmPlotBBox(0, 16),
    },
];

const VILLAGE_FARM_LANDMARKS = [
    { id: 'base.sim', type: 'house' as const, bbox: farmPlotBBox(0, 8), confidence: 0.9 },
    { id: 'base.low', type: 'house' as const, bbox: farmPlotBBox(6, 8), confidence: 0.9 },
    { id: 'base.unlinked', type: 'house' as const, bbox: farmPlotBBox(12, 8), confidence: 0.9 },
    { id: 'base.timeout', type: 'house' as const, bbox: farmPlotBBox(6, 16), confidence: 0.9 },
];

const VILLAGE_FARM_ASSERTIONS: readonly ScenarioAssertion[] = [
    {
        id: 'self-allowed',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(0, 0),
        decision: 'allow',
        message: 'self-owned plot must be allowed',
    },
    {
        id: 'other-denied',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(6, 0),
        decision: 'deny',
        message: 'other-owned plot must be denied',
    },
    {
        id: 'allowlisted-allowed',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(12, 0),
        decision: 'allow',
        message: 'allowlisted plot must be allowed',
    },
    {
        id: 'high-confidence-allowed',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(0, 8),
        decision: 'allow',
        message: 'high-confidence linked player must be able to grant access',
    },
    {
        id: 'low-confidence-denied',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(6, 8),
        decision: 'deny',
        message: 'low-confidence linked player must not grant access',
    },
    {
        id: 'unlinked-denied',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(12, 8),
        decision: 'deny',
        message: 'unlinked player must not grant access',
    },
    {
        id: 'ambiguous-denied',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(0, 16),
        decision: 'deny',
        message: 'ambiguous farm ownership must be denied',
    },
    {
        id: 'timeout-denied',
        kind: 'behavior.farm-permission',
        plotId: farmPlotId(6, 16),
        decision: 'timeout',
        message: 'silence must deny permission',
    },
    {
        id: 'harvested-wheat',
        kind: 'inventory.has',
        itemName: 'wheat',
        minimum: 12,
        message: 'permitted plots must produce harvested wheat',
    },
    {
        id: 'self-replanted',
        kind: 'world.blocks-in-box',
        bbox: farmPlotBBox(0, 0),
        blockId: 'wheat',
        minimum: 1,
        message: 'self-owned plot must be replanted',
    },
    {
        id: 'allowlisted-replanted',
        kind: 'world.blocks-in-box',
        bbox: farmPlotBBox(12, 0),
        blockId: 'wheat',
        minimum: 1,
        message: 'allowlisted plot must be replanted',
    },
    {
        id: 'high-confidence-replanted',
        kind: 'world.blocks-in-box',
        bbox: farmPlotBBox(0, 8),
        blockId: 'wheat',
        minimum: 1,
        message: 'high-confidence plot must be replanted',
    },
];

export class BehaviorScenarioCatalog {
    static definitions(): readonly BehaviorScenario[] {
        return [
            BehaviorScenarioCatalog.simulatedBuild(),
            BehaviorScenarioCatalog.earlyGameBootstrap(),
            BehaviorScenarioCatalog.villageFarm(),
            BehaviorScenarioCatalog.humanMovement(),
            BehaviorScenarioCatalog.humanSignature(),
            BehaviorScenarioCatalog.socialChat(),
            BehaviorScenarioCatalog.idleLife(),
            BehaviorScenarioCatalog.noOscillation(),
            BehaviorScenarioCatalog.simulatedMultiBot(),
            BehaviorScenarioCatalog.botRestartResume(),
        ];
    }

    static find(id: string): BehaviorScenario | null {
        return BehaviorScenarioCatalog.definitions().find((scenario) => scenario.id === id) ?? null;
    }

    private static earlyGameBootstrap(): BehaviorScenario {
        const blocks: NonNullable<BehaviorScenario['world']['blocks']>[number][] = [];
        for (let index = 0; index < 32; index += 1) {
            blocks.push({
                position: { x: 4 + (index % 4), y: 60, z: 4 + Math.floor(index / 4) },
                name: 'oak_log',
            });
        }
        for (let index = 0; index < 32; index += 1) {
            blocks.push({
                position: { x: -4, y: 60 + (index % 4), z: -5 + Math.floor(index / 4) },
                name: 'stone',
            });
        }
        return {
            id: 'early-game-bootstrap',
            title: 'Empty inventory reaches tools, stations, chest, and bed',
            mode: 'simulate',
            seed: 42,
            seeds: [42, 43, 44, 45, 46],
            world: {
                kind: 'flat',
                bounds: {
                    min: { x: -8, y: 55, z: -8 },
                    max: { x: 12, y: 70, z: 12 },
                },
                groundY: 59,
                clearRegion: {
                    min: { x: -4, y: 55, z: -4 },
                    max: { x: 4, y: 70, z: 4 },
                },
                entities: [{ id: 1, name: 'sheep', position: { x: 2, y: 60, z: 2 } }],
                blocks,
            },
            home: BOOTSTRAP_HOME,
            bots: [{ name: 'TiBot1', role: 'builder', inventory: {} }],
            startTime: { timeOfDay: 1000 },
            recipes: BOOTSTRAP_RECIPES,
            drops: { stone: 'cobblestone' },
            stopOnAssertions: true,
            assumptions: {
                planner: 'disabled',
                goalTieBreak: 'disabled',
                laya: 'deterministic',
                agency: 'enabled',
            },
            assertions: BOOTSTRAP_ASSERTIONS,
            timeoutTicks: 1_000,
            timeoutMilliseconds: 180_000,
        };
    }

    private static humanMovement(): BehaviorScenario {
        const base = BehaviorScenarioCatalog.earlyGameBootstrap();
        return {
            ...base,
            id: 'human-movement',
            title: 'Movement, gaze, and interaction pacing pass player-likeness gates',
            seeds: [142, 143, 144, 145, 146],
            assertions: [
                ...BOOTSTRAP_ASSERTIONS,
                {
                    id: 'movement-traced',
                    kind: 'behavior.trace-present',
                    traceKind: 'movement',
                    subject: 'move-to',
                    minimum: 1,
                    message: 'travel must produce movement traces',
                },
                {
                    id: 'gaze-traced',
                    kind: 'behavior.trace-present',
                    traceKind: 'gaze',
                    subject: 'interaction',
                    minimum: 1,
                    message: 'interactions must be preceded by gaze traces',
                },
                {
                    id: 'no-instant-turns',
                    kind: 'metric.threshold',
                    metric: 'instantTurns',
                    comparator: 'lte',
                    value: 0,
                    message: 'gaze changes must stay within the configured rate',
                },
                {
                    id: 'no-zero-look',
                    kind: 'metric.threshold',
                    metric: 'zeroLookInteractions',
                    comparator: 'lte',
                    value: 0,
                    message: 'interactions must not occur without a prior look',
                },
            ],
        };
    }

    private static humanSignature(): BehaviorScenario {
        const base = BehaviorScenarioCatalog.humanMovement();
        return {
            ...base,
            id: 'human-signature',
            title: 'Movement, gaze, pauses, and chat stay inside player ranges',
            seeds: [242, 243, 244, 245, 246],
            players: [{ id: 'uuid.alex', username: 'Alex', position: { x: 3, y: 60, z: 3 } }],
            chat: [{ atTick: 20, playerId: 'uuid.alex', message: 'hello TiBot1' }],
            assertions: [
                ...base.assertions,
                {
                    id: 'chat-incoming',
                    kind: 'behavior.trace-present',
                    traceKind: 'chat',
                    subject: 'incoming',
                    minimum: 1,
                    message: 'incoming chat must be traced',
                },
                {
                    id: 'chat-outgoing',
                    kind: 'behavior.trace-present',
                    traceKind: 'chat',
                    subject: 'outgoing',
                    minimum: 1,
                    message: 'social replies must be traced',
                },
                {
                    id: 'no-instant-chat',
                    kind: 'metric.threshold',
                    metric: 'instantChatReplies',
                    comparator: 'lte',
                    value: 0,
                    message: 'chat replies must respect the configured delay floor',
                },
            ],
        };
    }

    private static socialChat(): BehaviorScenario {
        const base = BehaviorScenarioCatalog.humanSignature();
        return {
            ...base,
            id: 'social-chat',
            title: 'Chat replies are delayed, varied, and rate-limited',
            seeds: [342, 343, 344, 345, 346],
            chat: [
                { atTick: 20, playerId: 'uuid.alex', message: 'hello TiBot1' },
                { atTick: 80, playerId: 'uuid.alex', message: 'how are you?' },
            ],
        };
    }

    private static idleLife(): BehaviorScenario {
        return {
            id: 'idle-life',
            title: 'Idle time is bounded, purposeful, and player-like',
            mode: 'simulate',
            seed: 442,
            seeds: [442, 443, 444, 445, 446],
            world: {
                kind: 'flat',
                bounds: {
                    min: { x: -8, y: 55, z: -8 },
                    max: { x: 8, y: 70, z: 8 },
                },
                groundY: 59,
            },
            home: {
                anchor: { x: 4, y: 60, z: 4 },
                bbox: { min: { x: 2, y: 59, z: 2 }, max: { x: 6, y: 65, z: 6 } },
                status: 'active',
                structureId: 'structure.idle-home',
            },
            bots: [
                {
                    name: 'TiBot1',
                    role: 'scout',
                    traits: { curiosity: 0.1, industriousness: 0.1, patience: 0.9 },
                    needs: {
                        safety: 1,
                        hunger: 1,
                        rest: 1,
                        materials: 1,
                        tools: 1,
                        shelter: 1,
                        social: 1,
                        novelty: 1,
                        achievement: 1,
                    },
                    inventory: { bread: 8, stone_pickaxe: 1, stone_sword: 1 },
                    position: { x: 4, y: 66, z: 4 },
                },
            ],
            resourceSites: [],
            actionLatencyMilliseconds: 20_000,
            agencyOverrides: { goalCadenceMilliseconds: 250 },
            startTime: { timeOfDay: 1000 },
            durationTicks: 7200,
            assertions: [
                {
                    id: 'idle-plan',
                    kind: 'behavior.trace-present',
                    traceKind: 'plan',
                    subject: 'idle-life',
                    minimum: 1,
                    message: 'idle behavior must be an explicit purposeful plan',
                },
                {
                    id: 'idle-fraction',
                    kind: 'behavior.idle-fraction',
                    minimum: 0.05,
                    maximum: 1,
                    botId: 'bot.tibot1',
                    message: 'idle time must be bounded and present',
                },
                {
                    id: 'no-idle-oddity',
                    kind: 'metric.threshold',
                    metric: 'noIdleOddities',
                    comparator: 'lte',
                    value: 0,
                    message: 'idle time must not disappear entirely',
                },
            ],
            assumptions: {
                planner: 'disabled',
                goalTieBreak: 'disabled',
                laya: 'deterministic',
                agency: 'enabled',
                progression: 'disabled',
            },
            timeoutTicks: 7200,
            timeoutMilliseconds: 600_000,
        };
    }

    private static noOscillation(): BehaviorScenario {
        const blocks: NonNullable<BehaviorScenario['world']['blocks']>[number][] = [];
        for (let index = 0; index < 96; index += 1) {
            blocks.push({
                position: { x: 4 + (index % 8), y: 60, z: 4 + Math.floor(index / 8) },
                name: 'oak_log',
            });
        }
        return {
            id: 'no-oscillation',
            title: 'Goal switching stays below the configured rate',
            mode: 'simulate',
            seed: 542,
            seeds: [542, 543, 544, 545, 546],
            world: {
                kind: 'flat',
                bounds: {
                    min: { x: -8, y: 55, z: -8 },
                    max: { x: 16, y: 70, z: 20 },
                },
                groundY: 59,
                blocks,
            },
            resourceSites: [{ kind: 'wood', position: { x: 4, y: 60, z: 4 } }],
            actionLatencyMilliseconds: 20_000,
            bots: [
                {
                    name: 'TiBot1',
                    role: 'builder',
                    traits: { curiosity: 0.1, industriousness: 0.8, patience: 0.9 },
                    needs: {
                        safety: 1,
                        hunger: 1,
                        rest: 1,
                        materials: 0,
                        tools: 1,
                        shelter: 1,
                        social: 1,
                        novelty: 1,
                        achievement: 1,
                    },
                    inventory: { bread: 8, stone_pickaxe: 1, stone_sword: 1 },
                    position: { x: 4, y: 66, z: 4 },
                },
            ],
            startTime: { timeOfDay: 1000 },
            durationTicks: 7200,
            stopOnAssertions: false,
            assertions: [
                {
                    id: 'goals-started',
                    kind: 'metric.threshold',
                    metric: 'goalsStarted',
                    comparator: 'gte',
                    value: 2,
                    message: 'the bot must start at least two goals',
                },
                {
                    id: 'switch-rate',
                    kind: 'behavior.switch-rate',
                    maximumPerTenMinutes: 2,
                    botId: 'bot.tibot1',
                    message: 'goal switching must stay below two per ten minutes',
                },
                {
                    id: 'dwell',
                    kind: 'behavior.dwell',
                    minimumMedianMilliseconds: 30_000,
                    botId: 'bot.tibot1',
                    message: 'goals must last long enough to be readable',
                },
                {
                    id: 'no-switch-storm',
                    kind: 'metric.threshold',
                    metric: 'switchStormOddities',
                    comparator: 'lte',
                    value: 0,
                    message: 'goal switching must not become a storm',
                },
            ],
            assumptions: {
                planner: 'disabled',
                goalTieBreak: 'disabled',
                laya: 'deterministic',
                agency: 'enabled',
                progression: 'disabled',
            },
            timeoutTicks: 7200,
            timeoutMilliseconds: 600_000,
        };
    }

    private static simulatedMultiBot(): BehaviorScenario {
        const base = BehaviorScenarioCatalog.simulatedBuild();
        return {
            ...base,
            id: 'simulated-multi-bot',
            title: 'Multiple bots build one structure without duplicate work',
            seeds: [647, 648, 649, 650, 651],
            bots: [
                { ...(base.bots[0] ?? { name: 'TiBot1', role: 'builder' }), name: 'TiBot1' },
                { ...(base.bots[0] ?? { name: 'TiBot2', role: 'builder' }), name: 'TiBot2' },
                { ...(base.bots[0] ?? { name: 'TiBot3', role: 'builder' }), name: 'TiBot3' },
            ],
        };
    }

    private static botRestartResume(): BehaviorScenario {
        const base = BehaviorScenarioCatalog.simulatedBuild();
        return {
            ...base,
            id: 'bot-restart-resume',
            title: 'Bot restart restores task, lease, and checkpoint',
            seeds: [747, 748, 749, 750, 751],
            faults: [
                {
                    atTick: 40,
                    type: 'bot-disconnect',
                    botId: 'bot.tibot1',
                },
            ],
        };
    }

    private static villageFarm(): BehaviorScenario {
        const tasks: NonNullable<BehaviorScenario['tasks']>[number][] = [
            {
                id: 'task.self.harvest',
                title: 'Harvest self-owned farm',
                skillId: 'harvest-farm',
                payload: { plotId: farmPlotId(0, 0) },
                delayMilliseconds: 7_000,
            },
            {
                id: 'task.self.plant',
                title: 'Replant self-owned farm',
                skillId: 'plant-farm',
                payload: { plotId: farmPlotId(0, 0), seedItem: 'wheat_seeds' },
                delayMilliseconds: 20_000,
                dependsOn: ['task.self.harvest'],
            },
            {
                id: 'task.allow.harvest',
                title: 'Harvest allowlisted farm',
                skillId: 'harvest-farm',
                payload: { plotId: farmPlotId(12, 0) },
                delayMilliseconds: 9_000,
            },
            {
                id: 'task.allow.plant',
                title: 'Replant allowlisted farm',
                skillId: 'plant-farm',
                payload: { plotId: farmPlotId(12, 0), seedItem: 'wheat_seeds' },
                delayMilliseconds: 25_000,
                dependsOn: ['task.allow.harvest'],
            },
            {
                id: 'task.high.harvest',
                title: 'Harvest linked-player farm',
                skillId: 'harvest-farm',
                payload: { plotId: farmPlotId(0, 8) },
                delayMilliseconds: 35_000,
            },
            {
                id: 'task.high.plant',
                title: 'Replant linked-player farm',
                skillId: 'plant-farm',
                payload: { plotId: farmPlotId(0, 8), seedItem: 'wheat_seeds' },
                delayMilliseconds: 50_000,
                dependsOn: ['task.high.harvest'],
            },
        ];
        return {
            id: 'village-farm',
            title: 'Resolve farm ownership, harvest, and replant permitted plots',
            mode: 'simulate',
            seed: 1847,
            seeds: [1847, 1848, 1849, 1850, 1851],
            world: {
                kind: 'flat',
                bounds: {
                    min: { x: -16, y: 55, z: -16 },
                    max: { x: 24, y: 70, z: 32 },
                },
                groundY: 59,
                clearRegion: {
                    min: { x: -14, y: 55, z: -14 },
                    max: { x: -6, y: 70, z: -6 },
                },
                blocks: farmBlocks(),
            },
            home: FARM_HOME,
            players: [
                { id: 'uuid.alex', username: 'Alex', position: { x: 4, y: 60, z: 4 } },
                { id: 'uuid.bob', username: 'Bob', position: { x: 8, y: 60, z: 8 } },
                { id: 'uuid.casey', username: 'Casey', position: { x: 14, y: 60, z: 8 } },
                { id: 'uuid.dana', username: 'Dana', position: { x: 8, y: 60, z: 18 } },
            ],
            claims: VILLAGE_FARM_CLAIMS,
            landmarks: VILLAGE_FARM_LANDMARKS,
            chat: [
                { atTick: 40, playerId: 'uuid.alex', message: 'yes' },
                { atTick: 41, playerId: 'uuid.bob', message: 'yes' },
                { atTick: 42, playerId: 'uuid.casey', message: 'yes' },
                ...Array.from({ length: 30 }, (_, index) => ({
                    atTick: 60 + index * 10,
                    playerId: 'uuid.alex',
                    message: 'yes',
                })),
            ],
            village: {
                allowedPlotRegions: [
                    {
                        id: 'region.allow',
                        min: { x: 11, y: 58, z: -1 },
                        max: { x: 15, y: 61, z: 3 },
                    },
                ],
                playerBaseLinks: [
                    {
                        playerId: 'uuid.alex',
                        username: 'Alex',
                        baseId: 'base.sim',
                        confidence: 0.8,
                    },
                    {
                        playerId: 'uuid.bob',
                        username: 'Bob',
                        baseId: 'base.low',
                        confidence: 0.4,
                    },
                    {
                        playerId: 'uuid.dana',
                        username: 'Dana',
                        baseId: 'base.timeout',
                        confidence: 0.8,
                    },
                ],
                playerConfidenceThreshold: 0.6,
                playerLinkRadius: 64,
                permissionAskCooldownMs: 1_000,
                permissionTimeoutMs: 60_000,
                permissionGrantTtlMs: 600_000,
            },
            bots: [
                {
                    name: 'TiBot1',
                    role: 'farmer',
                    inventory: {
                        wheat_seeds: 64,
                        bread: 8,
                        stone_hoe: 1,
                    },
                },
            ],
            startTime: { timeOfDay: 1000 },
            tasks,
            stopOnAssertions: true,
            assumptions: {
                planner: 'disabled',
                goalTieBreak: 'disabled',
                laya: 'deterministic',
                agency: 'disabled',
            },
            assertions: VILLAGE_FARM_ASSERTIONS,
            timeoutTicks: 1_200,
            timeoutMilliseconds: 180_000,
        };
    }

    private static simulatedBuild(): BehaviorScenario {
        return {
            id: 'simulated-build',
            title: 'Single bot builds a house on uneven terrain',
            mode: 'simulate',
            seed: 1847,
            world: {
                kind: 'uneven',
                bounds: {
                    min: { x: -8, y: 60, z: -8 },
                    max: { x: 24, y: 80, z: 24 },
                },
                groundY: 64,
                maximumStep: 2,
            },
            bots: [
                {
                    name: 'TiBot1',
                    role: 'builder',
                    inventory: {
                        oak_planks: 96,
                        cobblestone: 512,
                        dark_oak_planks: 128,
                        glass: 16,
                        oak_door: 8,
                        stone_pickaxe: 1,
                    },
                },
            ],
            startTime: { timeOfDay: 1000 },
            tasks: [BUILD_TASK],
            assumptions: {
                planner: 'disabled',
                goalTieBreak: 'disabled',
                laya: 'deterministic',
                agency: 'disabled',
            },
            assertions: BUILD_ASSERTIONS,
            timeoutTicks: 2000,
            timeoutMilliseconds: 120_000,
        };
    }
}

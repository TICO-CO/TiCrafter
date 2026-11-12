import type { ActionOutcome } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import { MineflayerActionExecutor } from './mineflayer-action-executor.js';
import { ReachRateGuard } from './reach-rate-guard.js';

type ShortcutCapablePathfinder = Bot['pathfinder'] & {
    enablePathShortcut: boolean;
};

interface FakeItem {
    name: string;
    count: number;
}

interface FakeContainer {
    slots: Array<FakeItem | null>;
    inventoryStart: number;
    close: () => Promise<void>;
    deposit: () => Promise<void>;
    withdraw: () => Promise<void>;
}

interface FakeBotState {
    bot: Bot;
    placedReference: Vec3 | null;
    placedFace: Vec3 | null;
    equippedItem: FakeItem | null;
    activatedBlock: { name: string } | null;
    movedSlots: Array<[number, number]>;
    pathfinderStops: number;
    pathShortcutValues: boolean[];
    controlClears: number;
    entities: Record<string, unknown>;
    container: FakeContainer;
}

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function createFakeBot(): FakeBotState {
    const state: FakeBotState = {
        bot: null as unknown as Bot,
        placedReference: null,
        placedFace: null,
        equippedItem: null,
        activatedBlock: null,
        movedSlots: [],
        pathfinderStops: 0,
        pathShortcutValues: [],
        controlClears: 0,
        entities: {},
        container: {
            slots: [null, null, null, { name: 'coal', count: 8 }, null],
            inventoryStart: 3,
            close: async () => undefined,
            deposit: async () => undefined,
            withdraw: async () => undefined,
        },
    };
    const items: FakeItem[] = [
        { name: 'stone', count: 4 },
        { name: 'wheat_seeds', count: 3 },
        { name: 'coal', count: 8 },
        { name: 'iron_ingot', count: 2 },
    ];
    let pathShortcutEnabled = false;
    const pathfinder = {
        get enablePathShortcut(): boolean {
            return pathShortcutEnabled;
        },
        set enablePathShortcut(value: boolean) {
            pathShortcutEnabled = value;
        },
        setMovements: () => undefined,
        stop: () => {
            state.pathfinderStops += 1;
        },
        goto: async () => {
            state.pathShortcutValues.push(pathShortcutEnabled);
            Object.keys(state.entities).forEach((key) => delete state.entities[key]);
        },
    };
    const bot = {
        entity: { position: new Vec3(4, 64, 0) },
        entities: state.entities,
        inventory: { items: () => items },
        registry: {
            itemsByName: {
                stone: { id: 1 },
                wheat_seeds: { id: 2 },
                coal: { id: 3 },
                iron_ingot: { id: 4 },
            },
            blocksByName: { crafting_table: { id: 5 } },
        },
        pathfinder,
        loadPlugin: () => undefined,
        blockAt: (position: Vec3) => ({
            name: 'oak_planks',
            position,
            getProperties: () => ({ facing: 'north' }),
        }),
        placeBlock: async (reference: { position: Vec3 }, face: Vec3) => {
            state.placedReference = reference.position;
            state.placedFace = face;
        },
        activateBlock: async (block: { name: string }) => {
            state.activatedBlock = block;
        },
        equip: async (item: FakeItem) => {
            state.equippedItem = item;
        },
        openContainer: async () => state.container,
        moveSlotItem: async (sourceSlot: number, destinationSlot: number) => {
            state.movedSlots.push([sourceSlot, destinationSlot]);
        },
        stopDigging: () => undefined,
        clearControlStates: () => {
            state.controlClears += 1;
        },
        recipesFor: () => [],
        findBlock: () => null,
    };
    state.bot = bot as unknown as Bot;
    return state;
}

async function waitForOutcome(
    executor: MineflayerActionExecutor,
    handleId: string,
): Promise<ActionOutcome | null> {
    for (let attempt = 0; attempt < 2000; attempt += 1) {
        const [outcome, error] = executor.poll(handleId);
        if (error !== null) return null;
        if (outcome !== null) return outcome;
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
    return null;
}

describe('mineflayer action executor', () => {
    it('uses an explicit placement reference and face', async () => {
        const state = createFakeBot();
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle, dispatchError] = executor.dispatch({
            kind: 'place-block',
            position: { x: 4, y: 64, z: 1 },
            itemName: 'stone',
            reference: { x: 4, y: 64, z: 0 },
            face: { x: 1, y: 0, z: 0 },
        });
        expect(dispatchError).toBeNull();
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
        expect(state.placedReference?.x).toBe(4);
        expect(state.placedReference?.z).toBe(0);
        expect(state.placedFace?.x).toBe(1);
    });

    it('rejects physical actions beyond reach', async () => {
        const state = createFakeBot();
        const executor = new MineflayerActionExecutor(
            state.bot,
            logger,
            undefined,
            new ReachRateGuard({
                maximumReach: 1,
                actionsPerSecond: 100,
                clock: () => 1_000,
            }),
        );
        const [handle] = executor.dispatch({
            kind: 'use-block',
            position: { x: 4, y: 64, z: 5 },
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('failed');
        expect(outcome?.message?.includes('exceeds reach')).toBe(true);
    });

    it('equips items before using blocks', async () => {
        const state = createFakeBot();
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle] = executor.dispatch({
            kind: 'use-block',
            position: { x: 4, y: 64, z: 0 },
            itemName: 'wheat_seeds',
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
        expect(state.equippedItem?.name).toBe('wheat_seeds');
        expect(state.activatedBlock?.name).toBe('oak_planks');
    });

    it('filters drops by item name', async () => {
        const state = createFakeBot();
        state.entities['1'] = {
            name: 'item',
            position: new Vec3(4, 64, 1),
            getDroppedItem: () => ({ name: 'stone' }),
        };
        state.entities['2'] = {
            name: 'item',
            position: new Vec3(4, 64, 2),
            getDroppedItem: () => ({ name: 'diamond' }),
        };
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle] = executor.dispatch({
            kind: 'collect-drops',
            radius: 8,
            itemName: 'diamond',
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
    });

    it('moves items into furnace fuel slots', async () => {
        const state = createFakeBot();
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle] = executor.dispatch({
            kind: 'transfer',
            direction: 'deposit',
            container: { x: 4, y: 64, z: 0 },
            itemName: 'coal',
            count: 1,
            slot: 'fuel',
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
        expect(state.movedSlots).toEqual([[3, 1]]);
    });

    it('withdraws furnace output into an empty inventory slot', async () => {
        const state = createFakeBot();
        state.container.slots = [null, null, { name: 'iron_ingot', count: 2 }, null, null];
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle] = executor.dispatch({
            kind: 'transfer',
            direction: 'withdraw',
            container: { x: 4, y: 64, z: 0 },
            itemName: 'iron_ingot',
            count: 2,
            slot: 'output',
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
        expect(state.movedSlots).toEqual([[2, 3]]);
    });

    it('enables path shortcuts for long moves', async () => {
        const state = createFakeBot();
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle] = executor.dispatch({
            kind: 'move-to',
            position: { x: 40, y: 64, z: 0 },
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
        expect(state.pathShortcutValues).toEqual([true]);
        expect((state.bot.pathfinder as ShortcutCapablePathfinder).enablePathShortcut).toBe(false);
    });

    it('keeps path shortcuts disabled for short moves', async () => {
        const state = createFakeBot();
        const executor = new MineflayerActionExecutor(state.bot, logger);
        const [handle] = executor.dispatch({
            kind: 'move-to',
            position: { x: 12, y: 64, z: 0 },
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('completed');
        expect(state.pathShortcutValues).toEqual([false]);
        expect((state.bot.pathfinder as ShortcutCapablePathfinder).enablePathShortcut).toBe(false);
    });

    it('stops movement when an action times out', async () => {
        const state = createFakeBot();
        const bot = state.bot as unknown as {
            pathfinder: ShortcutCapablePathfinder & { goto: () => Promise<void> };
        };
        bot.pathfinder.goto = () => {
            state.pathShortcutValues.push(bot.pathfinder.enablePathShortcut);
            return new Promise<void>(() => undefined);
        };
        const executor = new MineflayerActionExecutor(state.bot, logger, 10);
        const [handle] = executor.dispatch({
            kind: 'move-to',
            position: { x: 20, y: 64, z: 20 },
        });
        if (handle === null) return;

        const outcome = await waitForOutcome(executor, handle);
        expect(outcome?.status).toBe('failed');
        expect(outcome?.failure?.class).toBe('timeout');
        expect(state.pathfinderStops > 0).toBe(true);
        expect(state.controlClears > 0).toBe(true);
        expect(state.pathShortcutValues).toEqual([true]);
        expect(bot.pathfinder.enablePathShortcut).toBe(false);
        expect(executor.lastFailure?.class).toBe('timeout');
        expect(executor.lastFailureAt === null).toBe(false);
    });
});

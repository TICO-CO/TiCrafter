import type { Result } from '@ticrafter/core';
import type { SafetySnapshot } from '@ticrafter/safety';
import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { SafetySnapshotSource } from './safety-snapshot.js';
import type { WorldCacheAdapter } from './world-cache.js';

const MOVEMENT_SKILLS = [
    'navigate',
    'follow-path',
    'flee-defend',
    'explore',
    'bridge',
    'place-build',
    'repair',
    'clear',
    'harvest-farm',
    'plant-farm',
    'smelt',
    'deposit',
    'withdraw',
];

interface FakePlayer {
    entity: { position: { x: number; y: number; z: number } } | null;
}

interface FakeBotState {
    bot: Bot;
    entity: {
        position: { x: number; y: number; z: number };
        onGround: boolean;
        fallDistance?: number;
    };
    players: Record<string, FakePlayer>;
    inventorySlots: unknown[];
}

function createBot(): FakeBotState {
    const entity: FakeBotState['entity'] = {
        position: { x: 0, y: 64, z: 0 },
        onGround: true,
    };
    const players: Record<string, FakePlayer> = {};
    const inventorySlots = new Array<unknown>(46).fill(null);
    const bot = {
        username: 'TiBot1',
        entity,
        players,
        entities: {},
        health: 20,
        food: 20,
        oxygenLevel: 20,
        inventory: {
            items: () => [{ name: 'bread', count: 3 }],
            slots: inventorySlots,
        },
    };
    return {
        bot: bot as unknown as Bot,
        entity,
        players,
        inventorySlots,
    };
}

const worldCache = {
    blockAt: () => 'air',
} as unknown as WorldCacheAdapter;

function readSnapshot(source: SafetySnapshotSource): SafetySnapshot {
    const [snapshot, error] = source.read();
    expect(error).toBeNull();
    return snapshot as SafetySnapshot;
}

describe('safety snapshot source', () => {
    it('reports other configured online bots and excludes self', () => {
        const state = createBot();
        state.players.TiBot1 = { entity: { position: { x: 0, y: 64, z: 0 } } };
        state.players.TiBot2 = { entity: { position: { x: 5, y: 64, z: 1 } } };
        state.players.Stranger = { entity: { position: { x: 9, y: 64, z: 9 } } };
        state.players.TiBot3 = { entity: null };
        const source = new SafetySnapshotSource(state.bot, worldCache, () => null, {
            botNames: ['TiBot1', 'TiBot2', 'TiBot3'],
        });

        const snapshot = readSnapshot(source);

        expect(snapshot.world.activeBots()).toEqual([
            { botId: 'bot.tibot2', position: { x: 5, y: 64, z: 1 } },
        ]);
    });

    it('derives unreachable time from path failures', () => {
        let failure: { class: string; at: string } | null = null;
        const state = createBot();
        const source = new SafetySnapshotSource(state.bot, worldCache, () => 'navigate', {
            failureSource: () => failure,
        });

        expect(readSnapshot(source).targetUnreachableMilliseconds).toBe(0);
        failure = { class: 'no-path', at: new Date(Date.now() - 5000).toISOString() };
        expect(readSnapshot(source).targetUnreachableMilliseconds >= 4000).toBe(true);
        failure = { class: 'timeout', at: new Date(Date.now() - 3000).toISOString() };
        expect(readSnapshot(source).targetUnreachableMilliseconds >= 2000).toBe(true);
        failure = { class: 'missing-item', at: new Date(Date.now() - 5000).toISOString() };
        expect(readSnapshot(source).targetUnreachableMilliseconds).toBe(0);
        failure = { class: 'no-path', at: 'not-a-date' };
        expect(readSnapshot(source).targetUnreachableMilliseconds).toBe(0);
    });

    it('uses the fixed player inventory size', () => {
        const state = createBot();
        state.inventorySlots.push(null);
        const source = new SafetySnapshotSource(state.bot, worldCache, () => null);

        const snapshot = readSnapshot(source);

        expect(snapshot.inventoryTotalSlots).toBe(36);
        expect(snapshot.inventoryUsedSlots).toBe(1);
    });

    it('reads fall distance and marks dangerous falls', () => {
        const state = createBot();
        const source = new SafetySnapshotSource(state.bot, worldCache, () => null);

        const grounded = readSnapshot(source);
        expect(grounded.fallDistance).toBe(undefined);
        expect(grounded.falling).toBe(false);

        state.entity.fallDistance = 2;
        const falling = readSnapshot(source);
        expect(falling.fallDistance).toBe(2);
        expect(falling.falling).toBe(true);

        state.entity.fallDistance = 1.5;
        expect(readSnapshot(source).falling).toBe(false);
    });

    it('tracks stuck time for movement skills only', async () => {
        for (const skillId of MOVEMENT_SKILLS) {
            const state = createBot();
            const source = new SafetySnapshotSource(state.bot, worldCache, () => skillId);
            expect(readSnapshot(source).stuckMilliseconds).toBe(0);
            await new Promise((resolve) => setTimeout(resolve, 12));
            expect(readSnapshot(source).stuckMilliseconds > 0).toBe(true);
        }
        for (const skillId of ['craft', 'eat']) {
            const state = createBot();
            const source = new SafetySnapshotSource(state.bot, worldCache, () => skillId);
            expect(readSnapshot(source).stuckMilliseconds).toBe(0);
            await new Promise((resolve) => setTimeout(resolve, 12));
            expect(readSnapshot(source).stuckMilliseconds).toBe(0);
        }
    });
});

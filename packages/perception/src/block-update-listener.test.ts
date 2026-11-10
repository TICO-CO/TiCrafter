import { describe, expect, it } from 'bun:test';

import { type BlockUpdate, BlockUpdateListener } from './block-update-listener.js';

const update: BlockUpdate = {
    position: { x: 17, y: 64, z: -1 },
    blockId: 'oak_planks',
    solid: true,
    properties: { axis: 'x' },
};

describe('BlockUpdateListener', () => {
    it('turns a block update into a chunk observation', () => {
        const [observation, error] = new BlockUpdateListener().observe(
            'bot.tibot1',
            update,
            '2026-11-10T12:00:00.000Z',
        );

        expect(error).toBeNull();
        expect(observation).toEqual({
            type: 'block-update',
            botId: 'bot.tibot1',
            chunk: { x: 1, z: -1 },
            observedAt: '2026-11-10T12:00:00.000Z',
            block: {
                position: { x: 17, y: 64, z: -1 },
                blockId: 'oak_planks',
                solid: true,
                properties: { axis: 'x' },
            },
        });
    });

    it('omits properties when the update has none', () => {
        const [observation, error] = new BlockUpdateListener().observe(
            'bot.tibot1',
            { position: { x: 0, y: 64, z: 0 }, blockId: 'air', solid: false },
            '2026-11-10T12:00:00.000Z',
        );

        expect(error).toBeNull();
        expect(observation?.block).toEqual({
            position: { x: 0, y: 64, z: 0 },
            blockId: 'air',
            solid: false,
        });
    });

    it('rejects invalid positions', () => {
        const [observation, error] = new BlockUpdateListener().observe(
            'bot.tibot1',
            { ...update, position: { x: 0.5, y: 64, z: 0 } },
            '2026-11-10T12:00:00.000Z',
        );

        expect(observation).toBeNull();
        expect(error).toEqual({
            type: 'INVALID_BLOCK_POSITION',
            position: { x: 0.5, y: 64, z: 0 },
        });
    });

    it('rejects empty block ids', () => {
        const [observation, error] = new BlockUpdateListener().observe(
            'bot.tibot1',
            { ...update, blockId: '' },
            '2026-11-10T12:00:00.000Z',
        );

        expect(observation).toBeNull();
        expect(error).toEqual({ type: 'INVALID_BLOCK_ID', value: '' });
    });

    it('rejects invalid timestamps', () => {
        const [observation, error] = new BlockUpdateListener().observe(
            'bot.tibot1',
            update,
            'not-a-timestamp',
        );

        expect(observation).toBeNull();
        expect(error).toEqual({ type: 'INVALID_TIMESTAMP', value: 'not-a-timestamp' });
    });
});

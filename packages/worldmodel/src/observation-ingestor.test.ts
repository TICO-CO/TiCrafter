import { describe, expect, it } from 'bun:test';

import { InMemoryChunkStore } from './chunk-version-store.js';
import { ObservationIngestor } from './observation-ingestor.js';
import type { BlockUpdateObservation, ChunkObservation } from './types.js';

const observation: ChunkObservation = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 2,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: [
        {
            position: { x: 1, y: 64, z: 1 },
            blockId: 'stone',
            solid: true,
        },
    ],
};

describe('ObservationIngestor', () => {
    it('stores a new chunk version', () => {
        const store = new InMemoryChunkStore();
        const ingestor = new ObservationIngestor(store);
        const [result, error] = ingestor.ingest(observation);

        expect(error).toBeNull();
        expect(result?.outcome).toBe('stored');
        expect(result?.version).toBe(2);
    });

    it('ignores an equal or older chunk version', () => {
        const store = new InMemoryChunkStore();
        const ingestor = new ObservationIngestor(store);
        ingestor.ingest(observation);

        const [equalResult, equalError] = ingestor.ingest(observation);
        expect(equalError).toBeNull();
        expect(equalResult?.outcome).toBe('ignored');

        const [olderResult, olderError] = ingestor.ingest({ ...observation, version: 1 });
        expect(olderError).toBeNull();
        expect(olderResult?.outcome).toBe('ignored');
    });

    it('stores a newer chunk version', () => {
        const store = new InMemoryChunkStore();
        const ingestor = new ObservationIngestor(store);
        ingestor.ingest(observation);

        const [result, error] = ingestor.ingest({ ...observation, version: 3 });
        expect(error).toBeNull();
        expect(result?.outcome).toBe('stored');
        expect(result?.version).toBe(3);
    });

    it('applies block updates and bumps the chunk version', () => {
        const store = new InMemoryChunkStore();
        const ingestor = new ObservationIngestor(store);
        ingestor.ingest(observation);
        const update: BlockUpdateObservation = {
            botId: 'bot.tibot1',
            chunk: { x: 0, z: 0 },
            observedAt: '2026-11-10T12:00:10.000Z',
            block: {
                position: { x: 2, y: 64, z: 1 },
                blockId: 'dirt',
                solid: true,
            },
        };

        const [result, error] = ingestor.applyBlockUpdate(update);
        const [stored] = store.get({ x: 0, z: 0 });

        expect(error).toBeNull();
        expect(result?.version).toBe(3);
        expect(stored?.blocks).toHaveLength(2);
        expect(stored?.blocks.map((block) => block.blockId).sort()).toEqual(['dirt', 'stone']);
    });

    it('removes air blocks on update', () => {
        const store = new InMemoryChunkStore();
        const ingestor = new ObservationIngestor(store);
        ingestor.ingest(observation);

        ingestor.applyBlockUpdate({
            botId: 'bot.tibot1',
            chunk: { x: 0, z: 0 },
            observedAt: '2026-11-10T12:00:10.000Z',
            block: {
                position: { x: 1, y: 64, z: 1 },
                blockId: 'air',
                solid: false,
            },
        });

        const [stored] = store.get({ x: 0, z: 0 });
        expect(stored?.blocks).toHaveLength(0);
    });

    it('rejects block updates outside their chunk', () => {
        const store = new InMemoryChunkStore();
        const ingestor = new ObservationIngestor(store);

        const [, error] = ingestor.applyBlockUpdate({
            botId: 'bot.tibot1',
            chunk: { x: 0, z: 0 },
            observedAt: '2026-11-10T12:00:10.000Z',
            block: {
                position: { x: 20, y: 64, z: 1 },
                blockId: 'dirt',
                solid: true,
            },
        });

        expect(error?.type).toBe('INVALID_BLOCK_POSITION');
    });
});

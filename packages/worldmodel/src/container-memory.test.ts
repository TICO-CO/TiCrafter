import { describe, expect, it } from 'bun:test';

import { ContainerMemory, InMemoryContainerObservationStore } from './container-memory.js';
import type { ContainerObservation } from './types.js';

const observation: ContainerObservation = {
    id: 'container.chest.1',
    position: { x: 1, y: 64, z: 1 },
    role: 'storage',
    contents: [{ itemId: 'minecraft:oak_log', count: 12 }],
    observedAt: '2026-11-10T12:00:00.000Z',
    confidence: 0.8,
};

describe('ContainerMemory', () => {
    it('records and looks up observed containers', () => {
        const memory = new ContainerMemory(new InMemoryContainerObservationStore());

        const [, recordError] = memory.record(observation);
        const [stored, lookupError] = memory.at(observation.position);

        expect(recordError).toBeNull();
        expect(lookupError).toBeNull();
        expect(stored?.id).toBe(observation.id);
    });

    it('keeps the newest observation', () => {
        const memory = new ContainerMemory(new InMemoryContainerObservationStore());
        memory.record(observation);
        memory.record({
            ...observation,
            observedAt: '2026-11-10T13:00:00.000Z',
            contents: [{ itemId: 'minecraft:oak_log', count: 4 }],
        });
        memory.record({
            ...observation,
            observedAt: '2026-11-10T11:00:00.000Z',
            contents: [],
        });

        const [stored] = memory.at(observation.position);

        expect(stored?.observedAt).toBe('2026-11-10T13:00:00.000Z');
        expect(stored?.contents).toEqual([{ itemId: 'minecraft:oak_log', count: 4 }]);
    });

    it('rejects invalid observations', () => {
        const memory = new ContainerMemory(new InMemoryContainerObservationStore());

        const [, error] = memory.record({
            ...observation,
            confidence: 2,
        });

        expect(error?.type).toBe('INVALID_CONTAINER_OBSERVATION');
    });
});

import { describe, expect, it } from 'bun:test';

import { FakeWorld } from './fake-world.js';

const world = (): FakeWorld =>
    new FakeWorld({
        seed: 7,
        kind: 'flat',
        min: { x: 0, y: 60, z: 0 },
        max: { x: 10, y: 70, z: 10 },
        groundY: 64,
    });

describe('FakeWorld', () => {
    it('generates deterministic terrain and air above ground', () => {
        const fake = world();
        expect(fake.blockAt({ x: 5, y: 63, z: 5 })).toBe('grass_block');
        expect(fake.blockAt({ x: 5, y: 64, z: 5 })).toBe('air');
        expect(fake.blockAt({ x: 20, y: 64, z: 20 })).toBeNull();
    });

    it('applies blocks atomically and emits changes', () => {
        const fake = world();
        const changes: string[] = [];
        const unsubscribe = fake.onBlockChanged((change) => changes.push(change.blockId));

        fake.applyBlock({ x: 1, y: 64, z: 1 }, { name: 'oak_planks', properties: {} });
        expect(fake.blockAt({ x: 1, y: 64, z: 1 })).toBe('oak_planks');
        expect(changes).toEqual(['oak_planks']);
        unsubscribe();
        fake.applyBlock({ x: 1, y: 64, z: 1 }, null);
        expect(fake.blockAt({ x: 1, y: 64, z: 1 })).toBe('air');
        expect(changes).toEqual(['oak_planks']);
    });
});

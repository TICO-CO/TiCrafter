import { describe, expect, it } from 'bun:test';

import { SeededRandom } from './seeded-random.js';

describe('SeededRandom', () => {
    it('replays the same sequence for the same seed', () => {
        const first = new SeededRandom(1847);
        const second = new SeededRandom(1847);

        expect(Array.from({ length: 8 }, () => first.next())).toEqual(
            Array.from({ length: 8 }, () => second.next()),
        );
    });

    it('keeps integers inside the requested range', () => {
        const random = new SeededRandom(42);

        for (let index = 0; index < 50; index += 1) {
            const value = random.integer(3, 7);
            expect(value >= 3).toBe(true);
            expect(value <= 7).toBe(true);
        }
    });

    it('returns undefined when picking from an empty list', () => {
        const random = new SeededRandom(42);

        expect(random.pick([]) === undefined).toBe(true);
    });

    it('shuffles without mutating the input', () => {
        const values = [1, 2, 3, 4];
        const random = new SeededRandom(42);

        const shuffled = random.shuffle(values);

        expect(values).toEqual([1, 2, 3, 4]);
        expect([...shuffled].sort()).toEqual([1, 2, 3, 4]);
    });
});

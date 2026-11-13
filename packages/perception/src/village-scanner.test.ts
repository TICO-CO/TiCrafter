import { describe, expect, it } from 'bun:test';

import { VillageScanner } from './village-scanner.js';

describe('VillageScanner', () => {
    it('clusters villagers with nearby structures', () => {
        const candidates = new VillageScanner().scan({
            villagers: [
                { x: 0, y: 64, z: 0 },
                { x: 3, y: 64, z: 1 },
            ],
            beds: [
                { x: 1, y: 64, z: 2 },
                { x: 2, y: 64, z: 3 },
            ],
            doors: [{ x: 1, y: 64, z: 0 }],
            workstations: [{ x: 4, y: 64, z: 0 }],
            farmland: [{ x: 2, y: 64, z: 2 }],
        });
        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.villagers).toBe(2);
        expect(candidates[0]?.beds).toBe(2);
    });

    it('ignores isolated villagers or sparse structures', () => {
        const scanner = new VillageScanner();
        expect(
            scanner.scan({
                villagers: [{ x: 0, y: 64, z: 0 }],
                beds: [],
                doors: [],
                workstations: [],
                farmland: [],
            }),
        ).toHaveLength(0);
        expect(
            scanner.scan({
                villagers: [
                    { x: 0, y: 64, z: 0 },
                    { x: 1, y: 64, z: 0 },
                ],
                beds: [],
                doors: [],
                workstations: [],
                farmland: [],
            }),
        ).toHaveLength(0);
    });

    it('separates distant villages', () => {
        const candidates = new VillageScanner().scan({
            villagers: [
                { x: 0, y: 64, z: 0 },
                { x: 2, y: 64, z: 0 },
                { x: 100, y: 64, z: 100 },
                { x: 102, y: 64, z: 100 },
            ],
            beds: [
                { x: 1, y: 64, z: 1 },
                { x: 101, y: 64, z: 101 },
            ],
            doors: [
                { x: 0, y: 64, z: 1 },
                { x: 100, y: 64, z: 101 },
            ],
            workstations: [
                { x: 2, y: 64, z: 1 },
                { x: 102, y: 64, z: 101 },
            ],
            farmland: [],
        });
        expect(candidates).toHaveLength(2);
    });
});

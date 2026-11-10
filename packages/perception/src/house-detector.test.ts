import { describe, expect, it } from 'bun:test';

import { HouseDetector } from './house-detector.js';
import type { ChunkSnapshot, VoxelBlock, VoxelPosition } from './types.js';

function solid(position: VoxelPosition, blockId = 'stone'): VoxelBlock {
    return { position, blockId, solid: true };
}

function houseBlocks(): readonly VoxelBlock[] {
    const blocks = new Map<string, VoxelBlock>();
    for (let y = 63; y <= 68; y += 1) {
        for (let x = 0; x <= 5; x += 1) {
            for (let z = 0; z <= 5; z += 1) {
                const boundary = x === 0 || x === 5 || z === 0 || z === 5 || y === 63 || y === 68;
                if (boundary) blocks.set(`${x},${y},${z}`, solid({ x, y, z }));
            }
        }
    }
    blocks.set('2,64,0', solid({ x: 2, y: 64, z: 0 }, 'oak_door'));
    blocks.set('0,65,2', solid({ x: 0, y: 65, z: 2 }, 'glass'));
    blocks.set('3,64,3', {
        position: { x: 3, y: 64, z: 3 },
        blockId: 'red_bed',
        solid: false,
    });
    return [...blocks.values()];
}

const snapshot: ChunkSnapshot = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 1,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: houseBlocks(),
};

describe('HouseDetector', () => {
    it('detects an enclosed house with doors, beds, windows, and a roof', () => {
        const [candidate] = new HouseDetector().detect(snapshot);

        expect(candidate?.type).toBe('house');
        expect(candidate?.bbox).toEqual({
            min: { x: 0, y: 63, z: 0 },
            max: { x: 5, y: 68, z: 5 },
        });
        expect(candidate?.anchors.map((anchor) => anchor.name)).toEqual(['center', 'door']);
        expect(candidate?.confidence).toBe(0.95);
        expect(candidate?.evidence.includes('features bed,door,roof,window')).toBe(true);
    });

    it('ignores structures with an open wall', () => {
        const blocks = houseBlocks().filter(
            (block) => block.position.x !== 5 || block.position.y !== 65 || block.position.z !== 2,
        );
        const candidates = new HouseDetector().detect({ ...snapshot, blocks });

        expect(candidates).toHaveLength(0);
    });

    it('ignores an enclosed cavity without house features', () => {
        const blocks = new Map<string, VoxelBlock>();
        for (let x = 0; x <= 3; x += 1) {
            for (let y = 0; y <= 3; y += 1) {
                for (let z = 0; z <= 3; z += 1) {
                    const boundary = x === 0 || x === 3 || y === 0 || y === 3 || z === 0 || z === 3;
                    if (boundary) blocks.set(`${x},${y},${z}`, solid({ x, y, z }));
                }
            }
        }
        const candidates = new HouseDetector().detect({
            ...snapshot,
            blocks: [...blocks.values()],
        });

        expect(candidates).toHaveLength(0);
    });

    it('keeps non-solid doors as part of the shell', () => {
        const blocks = houseBlocks()
            .filter(
                (block) =>
                    block.position.x !== 2 || block.position.y !== 64 || block.position.z !== 0,
            )
            .concat({
                position: { x: 2, y: 64, z: 0 },
                blockId: 'oak_door',
                solid: false,
            });
        const [candidate] = new HouseDetector().detect({ ...snapshot, blocks });

        expect(candidate?.type).toBe('house');
        expect(candidate?.anchors.map((anchor) => anchor.name)).toEqual(['center', 'door']);
    });

    it('ignores solid blocks without an enclosed interior', () => {
        const blocks = [solid({ x: 0, y: 64, z: 0 }), solid({ x: 1, y: 64, z: 0 })];
        const candidates = new HouseDetector().detect({ ...snapshot, blocks });

        expect(candidates).toHaveLength(0);
    });

    it('ignores interiors shorter than two blocks', () => {
        const blocks = new Map<string, VoxelBlock>();
        for (let x = 0; x <= 4; x += 1) {
            for (let z = 0; z <= 4; z += 1) {
                blocks.set(`${x},63,${z}`, solid({ x, y: 63, z }));
                blocks.set(`${x},65,${z}`, solid({ x, y: 65, z }));
            }
        }
        for (let y = 63; y <= 65; y += 1) {
            for (let along = 0; along <= 4; along += 1) {
                blocks.set(`0,${y},${along}`, solid({ x: 0, y, z: along }));
                blocks.set(`4,${y},${along}`, solid({ x: 4, y, z: along }));
                blocks.set(`${along},${y},0`, solid({ x: along, y, z: 0 }));
                blocks.set(`${along},${y},4`, solid({ x: along, y, z: 4 }));
            }
        }
        const candidates = new HouseDetector().detect({
            ...snapshot,
            blocks: [...blocks.values()],
        });

        expect(candidates).toHaveLength(0);
    });
});

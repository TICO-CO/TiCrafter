import { describe, expect, it } from 'bun:test';

import { LinearStructureDetector } from './linear-structure-detector.js';
import type { ChunkSnapshot, VoxelBlock } from './types.js';

function solid(x: number, y: number, z: number): VoxelBlock {
    return { position: { x, y, z }, blockId: 'stone', solid: true };
}

function layer(xRange: number, zRange: number, y: number): readonly VoxelBlock[] {
    const blocks: VoxelBlock[] = [];
    for (let x = 0; x <= xRange; x += 1) {
        for (let z = 0; z <= zRange; z += 1) {
            blocks.push(solid(x, y, z));
        }
    }
    return blocks;
}

function snapshot(blocks: readonly VoxelBlock[]): ChunkSnapshot {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        version: 1,
        observedAt: '2026-11-10T12:00:00.000Z',
        blocks,
    };
}

describe('LinearStructureDetector', () => {
    it('detects a wall on top of the ground', () => {
        const blocks = [
            ...layer(9, 2, 62),
            ...layer(9, 2, 63),
            ...layer(9, 0, 64),
            ...layer(9, 0, 65),
            ...layer(9, 0, 66),
        ];
        const candidates = new LinearStructureDetector().detect(snapshot(blocks));

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.type).toBe('wall');
        expect(candidates[0]?.bbox).toEqual({
            min: { x: 0, y: 64, z: 0 },
            max: { x: 9, y: 66, z: 0 },
        });
        expect(candidates[0]?.confidence).toBe(0.77625);
    });

    it('detects a bridge deck over air', () => {
        const candidates = new LinearStructureDetector().detect(snapshot(layer(9, 2, 64)));

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.type).toBe('bridge');
        expect(candidates[0]?.bbox).toEqual({
            min: { x: 0, y: 64, z: 0 },
            max: { x: 9, y: 64, z: 2 },
        });
        expect(candidates[0]?.evidence.includes('deck-over-air 1.00')).toBe(true);
    });

    it('detects a covered mineshaft corridor', () => {
        const blocks = [...layer(9, 2, 64), ...layer(9, 2, 67)];
        const candidates = new LinearStructureDetector().detect(snapshot(blocks));

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.type).toBe('mineshaft');
        expect(candidates[0]?.bbox).toEqual({
            min: { x: 0, y: 64, z: 0 },
            max: { x: 9, y: 67, z: 2 },
        });
        expect(candidates[0]?.evidence.includes('open-gap 1.00')).toBe(true);
    });

    it('detects a diagonal wall using line fitting', () => {
        const ground: VoxelBlock[] = [];
        for (let x = 0; x <= 9; x += 1) {
            for (let z = 0; z <= 9; z += 1) {
                ground.push(solid(x, 63, z));
            }
        }
        const wall = Array.from({ length: 10 }, (_, index) =>
            [64, 65, 66].map((y) => solid(index, y, index)),
        ).flat();
        const candidates = new LinearStructureDetector().detect(snapshot([...ground, ...wall]));

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.type).toBe('wall');
        expect(candidates[0]?.evidence.includes('axis diagonal')).toBe(true);
    });

    it('detects a diagonal bridge over air', () => {
        const blocks = Array.from({ length: 10 }, (_, index) => solid(index, 64, index));
        const candidates = new LinearStructureDetector().detect(snapshot(blocks));

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.type).toBe('bridge');
        expect(candidates[0]?.evidence.includes('axis diagonal')).toBe(true);
    });

    it('does not classify an unsupported surface path as a bridge', () => {
        const blocks = Array.from({ length: 10 }, (_, index) => ({
            position: { x: index, y: 64, z: 0 },
            blockId: 'dirt_path',
            solid: true,
        }));
        const candidates = new LinearStructureDetector().detect(snapshot(blocks));

        expect(candidates).toHaveLength(0);
    });

    it('ignores linear structures shorter than the minimum length', () => {
        const blocks = [...layer(6, 1, 63), ...layer(6, 0, 64), ...layer(6, 0, 65)];
        const candidates = new LinearStructureDetector().detect(snapshot(blocks));

        expect(candidates).toHaveLength(0);
    });
});

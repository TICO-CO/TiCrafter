import { describe, expect, it } from 'bun:test';

import { PathDetector } from './path-detector.js';
import type { ChunkSnapshot, VoxelBlock } from './types.js';

function corridor(axis: 'x' | 'z', length: number, perpendicular = 0): readonly VoxelBlock[] {
    return Array.from({ length }, (_, index) => ({
        position:
            axis === 'x'
                ? { x: index, y: 64, z: perpendicular }
                : { x: perpendicular, y: 64, z: index },
        blockId: 'stone',
        solid: true,
    }));
}

const snapshot: ChunkSnapshot = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 1,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: corridor('x', 10),
};

describe('PathDetector', () => {
    it('detects a straight standable corridor', () => {
        const [candidate] = new PathDetector().detect(snapshot);

        expect(candidate?.type).toBe('path');
        expect(candidate?.bbox).toEqual({
            min: { x: 0, y: 63, z: 0 },
            max: { x: 9, y: 65, z: 0 },
        });
        expect(candidate?.anchors).toHaveLength(2);
        expect(candidate?.confidence).toBe(0.65625);
    });

    it('ignores corridors shorter than the minimum length', () => {
        const candidates = new PathDetector().detect({ ...snapshot, blocks: corridor('x', 7) });

        expect(candidates).toHaveLength(0);
    });

    it('splits a corridor blocked by solid headroom', () => {
        const blocks = [
            ...corridor('x', 10),
            { position: { x: 5, y: 65, z: 0 }, blockId: 'stone', solid: true },
        ];
        const candidates = new PathDetector().detect({ ...snapshot, blocks });

        expect(candidates).toHaveLength(0);
    });

    it('detects corridors along the z axis', () => {
        const [candidate] = new PathDetector().detect({ ...snapshot, blocks: corridor('z', 10) });

        expect(candidate?.bbox).toEqual({
            min: { x: 0, y: 63, z: 0 },
            max: { x: 0, y: 65, z: 9 },
        });
    });

    it('merges adjacent rows into a width-three corridor', () => {
        const blocks = [0, 1, 2].flatMap((perpendicular) => corridor('x', 10, perpendicular));
        const candidates = new PathDetector().detect({ ...snapshot, blocks });

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.bbox).toEqual({
            min: { x: 0, y: 63, z: 0 },
            max: { x: 9, y: 65, z: 2 },
        });
        expect(candidates[0]?.evidence).toBe(
            'standable corridor length 10 width 3 materials stone',
        );
    });

    it('includes sorted material hints in evidence', () => {
        const blocks = corridor('x', 10).map((block, index) =>
            index === 0 ? { ...block, blockId: 'oak_planks' } : block,
        );
        const [candidate] = new PathDetector().detect({ ...snapshot, blocks });

        expect(candidate?.evidence).toBe(
            'standable corridor length 10 width 1 materials oak_planks,stone',
        );
    });

    it('ignores corridors wider than three rows', () => {
        const blocks = [0, 1, 2, 3].flatMap((perpendicular) => corridor('x', 10, perpendicular));
        const candidates = new PathDetector().detect({ ...snapshot, blocks });

        expect(candidates).toHaveLength(0);
    });
});

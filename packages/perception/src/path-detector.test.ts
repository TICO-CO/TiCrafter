import { describe, expect, it } from 'bun:test';

import { PathDetector } from './path-detector.js';
import type { ChunkSnapshot, VoxelBlock } from './types.js';

function corridor(axis: 'x' | 'z', length: number): readonly VoxelBlock[] {
    return Array.from({ length }, (_, index) => ({
        position: axis === 'x' ? { x: index, y: 64, z: 0 } : { x: 0, y: 64, z: index },
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
});

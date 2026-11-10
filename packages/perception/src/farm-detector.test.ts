import { describe, expect, it } from 'bun:test';

import { FarmDetector } from './farm-detector.js';
import type { ChunkSnapshot, VoxelBlock } from './types.js';

function farmland(x: number, z: number, moisture = '7'): VoxelBlock {
    return {
        position: { x, y: 64, z },
        blockId: 'farmland',
        solid: true,
        properties: { moisture },
    };
}

function crop(x: number, z: number, age = '7'): VoxelBlock {
    return {
        position: { x, y: 65, z },
        blockId: 'wheat',
        solid: false,
        properties: { age },
    };
}

function plotSnapshot(): ChunkSnapshot {
    const blocks = Array.from({ length: 9 }, (_, index) => {
        const x = index % 3;
        const z = Math.floor(index / 3);
        return [farmland(x, z), crop(x, z)];
    }).flat();
    blocks.push({ position: { x: 3, y: 64, z: 1 }, blockId: 'water', solid: false });
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        version: 1,
        observedAt: '2026-11-10T12:00:00.000Z',
        blocks,
    };
}

describe('FarmDetector', () => {
    it('detects a hydrated crop plot', () => {
        const [candidate] = new FarmDetector().detect(plotSnapshot());

        expect(candidate?.type).toBe('farm');
        expect(candidate?.bbox).toEqual({
            min: { x: 0, y: 64, z: 0 },
            max: { x: 2, y: 65, z: 2 },
        });
        expect(candidate?.anchors.map((anchor) => anchor.name)).toEqual(['center', 'water']);
        expect(candidate?.confidence).toBe(0.95);
        expect(candidate?.evidence).toBe(
            'farmland blocks 9 hydrated 9 water 1 crops 9 average age 7.0',
        );
    });

    it('ignores plots below the minimum size', () => {
        const candidates = new FarmDetector().detect({
            ...plotSnapshot(),
            blocks: [farmland(0, 0), farmland(1, 0)],
        });

        expect(candidates).toHaveLength(0);
    });

    it('reports dry plots without crops', () => {
        const [candidate] = new FarmDetector().detect({
            ...plotSnapshot(),
            blocks: [farmland(0, 0, '0'), farmland(1, 0, '0'), farmland(2, 0, '0')],
        });

        expect(candidate?.bbox.max.y).toBe(64);
        expect(candidate?.evidence).toBe(
            'farmland blocks 3 hydrated 0 water 0 crops 0 average age 0.0',
        );
    });

    it('uses nearby water when moisture properties are missing', () => {
        const dry: VoxelBlock = {
            position: { x: 0, y: 64, z: 0 },
            blockId: 'farmland',
            solid: true,
        };
        const second: VoxelBlock = {
            position: { x: 1, y: 64, z: 0 },
            blockId: 'farmland',
            solid: true,
        };
        const third: VoxelBlock = {
            position: { x: 2, y: 64, z: 0 },
            blockId: 'farmland',
            solid: true,
        };
        const water: VoxelBlock = {
            position: { x: 3, y: 64, z: 0 },
            blockId: 'water',
            solid: false,
        };
        const [candidate] = new FarmDetector().detect({
            ...plotSnapshot(),
            blocks: [dry, second, third, water],
        });

        expect(candidate?.evidence.includes('hydrated 3')).toBe(true);
    });
});

import type { DetectionCandidate } from '@ticrafter/perception';
import type { SkillBlock } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { FarmPlotRegistry } from './farm-plot-registry.js';

const candidate: DetectionCandidate = {
    detectorId: 'farm',
    type: 'farm',
    bbox: { min: { x: 1, y: 63, z: 2 }, max: { x: 4, y: 64, z: 5 } },
    anchors: [{ name: 'center', position: { x: 2, y: 64, z: 3 } }],
    confidence: 0.8,
    evidence: 'farmland blocks 9',
};

describe('FarmPlotRegistry', () => {
    it('derives crop and seed data from observed world blocks', () => {
        const blocks: SkillBlock[] = [
            { name: 'farmland', position: { x: 1, y: 63, z: 2 }, properties: {} },
            { name: 'wheat', position: { x: 1, y: 64, z: 2 }, properties: { age: '7' } },
            { name: 'carrots', position: { x: 2, y: 64, z: 2 }, properties: {} },
        ];
        const registry = new FarmPlotRegistry({
            world: {
                blocksInBox: () => blocks,
            },
        });
        const [plot] = [registry.observe(candidate, 100)];
        expect(plot?.id).toBe('farm.1.63.2');
        expect(plot?.cropBlockIds).toEqual(['carrots', 'wheat']);
        expect(plot?.seedItem).toBe('carrot');
        expect(registry.list()).toHaveLength(1);
        expect(registry.getPlot('farm.1.63.2')[0]?.seedItem).toBe('carrot');
    });

    it('ignores non-farm candidates and bounds remembered plots', () => {
        const registry = new FarmPlotRegistry({
            world: { blocksInBox: () => [] },
            maximumPlots: 1,
        });
        expect(registry.observe({ ...candidate, type: 'house' })).toBeNull();
        registry.observe(candidate, 100);
        registry.observe(
            {
                ...candidate,
                bbox: { min: { x: 10, y: 63, z: 10 }, max: { x: 12, y: 64, z: 12 } },
            },
            200,
        );
        expect(registry.list()).toHaveLength(1);
        expect(registry.list()[0]?.id).toBe('farm.10.63.10');
    });
});

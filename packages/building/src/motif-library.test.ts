import { describe, expect, it } from 'bun:test';

import { MotifInterior } from './motif-interior.js';
import { MotifLibrary } from './motif-library.js';
import { MotifOutdoor } from './motif-outdoor.js';

describe('MotifLibrary', () => {
    it('builds a two-block door', () => {
        const blocks = MotifLibrary.door(4, 1, 2, 'north', 'oak_door', 3);

        expect(blocks).toHaveLength(2);
        expect(blocks[0]?.state.properties?.half).toBe('lower');
        expect(blocks[1]?.state.properties?.half).toBe('upper');
    });

    it('builds a bed with head and foot', () => {
        const blocks = MotifInterior.bed(4, 1, 2, 'south', 'red_bed', 4);

        expect(blocks.map((block) => block.state.properties?.part)).toEqual(['foot', 'head']);
        expect(blocks[1]?.z).toBe(3);
    });

    it('builds a farm plot with a crop above farmland', () => {
        const blocks = MotifOutdoor.farmPlot(2, 0, 2, 'wheat', 0);

        expect(blocks[0]?.state.name).toBe('farmland');
        expect(blocks[1]?.state.name).toBe('wheat');
        expect(blocks[1]?.y).toBe(1);
    });

    it('builds a roof row across the requested span', () => {
        const blocks = MotifOutdoor.roofRow(2, 5, 1, 4, 'dark_oak_planks', 2);

        expect(blocks).toHaveLength(4);
        expect(blocks[0]?.z).toBe(1);
        expect(blocks[3]?.z).toBe(4);
    });

    it('builds a closed gate', () => {
        const gate = MotifOutdoor.gate(1, 1, 1, 'south', 'oak_fence_gate', 3);

        expect(gate.state.properties).toEqual({ facing: 'south', open: 'false' });
    });
});

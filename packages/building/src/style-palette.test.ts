import { describe, expect, it } from 'bun:test';

import { StylePalette } from './style-palette.js';

describe('StylePalette', () => {
    it('resolves a named palette', () => {
        const palette = StylePalette.resolve({
            palette: 'oak_and_cobblestone',
            roof: 'gable',
            symmetry: 0.8,
            decoration: 0.5,
        });

        expect(palette.structure).toBe('oak_planks');
        expect(palette.floor).toBe('cobblestone');
        expect(palette.fence).toBe('oak_fence');
    });

    it('falls back to the default palette', () => {
        const palette = StylePalette.resolve({
            palette: 'missing_palette',
            roof: 'gable',
            symmetry: 0.8,
            decoration: 0.5,
        });

        expect(palette.structure).toBe('oak_planks');
    });

    it('lists every palette name', () => {
        expect(StylePalette.names().includes('sandstone')).toBe(true);
        expect(StylePalette.names()).toEqual([...StylePalette.names()].sort());
    });

    it('keeps starter palettes free of brick and smelted materials', () => {
        for (const name of StylePalette.starterNames()) {
            const palette = StylePalette.resolve({
                palette: name,
                roof: 'gable',
                symmetry: 0.8,
                decoration: 0,
            });
            expect(palette.floor.includes('brick')).toBe(false);
            expect(palette.accent.includes('brick')).toBe(false);
            expect(palette.glass).not.toBe('glass');
            expect(palette.glass).not.toBe('glass_pane');
            expect(palette.floor).not.toBe('smooth_sandstone');
            expect(palette.floor).not.toBe('stone');
            expect(palette.accent).not.toBe('stone');
        }
    });

    it('floors the starter spruce palette with gatherable cobblestone', () => {
        const palette = StylePalette.resolve({
            palette: 'starter_spruce_and_cobblestone',
            roof: 'gable',
            symmetry: 0.8,
            decoration: 0,
        });

        expect(palette.floor).toBe('cobblestone');
    });
});

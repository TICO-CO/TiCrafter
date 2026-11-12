import type { StyleProfile } from './blueprint-document.js';

export interface PaletteMaterials {
    structure: string;
    floor: string;
    roof: string;
    accent: string;
    glass: string;
    door: string;
    light: string;
    furniture: string;
    crop: string;
    fence: string;
    gate: string;
    path: string;
}

const palettes = {
    oak_and_cobblestone: {
        structure: 'oak_planks',
        floor: 'cobblestone',
        roof: 'dark_oak_planks',
        accent: 'cobblestone',
        glass: 'glass',
        door: 'oak_door',
        light: 'torch',
        furniture: 'oak_planks',
        crop: 'wheat',
        fence: 'oak_fence',
        gate: 'oak_fence_gate',
        path: 'dirt_path',
    },
    spruce_and_stone: {
        structure: 'spruce_planks',
        floor: 'stone',
        roof: 'dark_oak_planks',
        accent: 'stone_bricks',
        glass: 'glass_pane',
        door: 'spruce_door',
        light: 'lantern',
        furniture: 'spruce_planks',
        crop: 'carrots',
        fence: 'spruce_fence',
        gate: 'spruce_fence_gate',
        path: 'gravel',
    },
    sandstone: {
        structure: 'sandstone',
        floor: 'smooth_sandstone',
        roof: 'sandstone',
        accent: 'cut_sandstone',
        glass: 'glass',
        door: 'birch_door',
        light: 'torch',
        furniture: 'birch_planks',
        crop: 'wheat',
        fence: 'birch_fence',
        gate: 'birch_fence_gate',
        path: 'sand',
    },
    dark_oak_and_brick: {
        structure: 'dark_oak_planks',
        floor: 'bricks',
        roof: 'dark_oak_planks',
        accent: 'bricks',
        glass: 'glass',
        door: 'dark_oak_door',
        light: 'lantern',
        furniture: 'dark_oak_planks',
        crop: 'potatoes',
        fence: 'dark_oak_fence',
        gate: 'dark_oak_fence_gate',
        path: 'dirt_path',
    },
    birch_and_cobblestone: {
        structure: 'birch_planks',
        floor: 'cobblestone',
        roof: 'spruce_planks',
        accent: 'cobblestone',
        glass: 'glass',
        door: 'birch_door',
        light: 'torch',
        furniture: 'birch_planks',
        crop: 'beetroots',
        fence: 'birch_fence',
        gate: 'birch_fence_gate',
        path: 'dirt_path',
    },
} satisfies Record<string, PaletteMaterials>;

export type PaletteName = keyof typeof palettes;

const fallbackPalette: PaletteName = 'oak_and_cobblestone';

export class StylePalette {
    static names(): readonly string[] {
        return Object.keys(palettes).sort();
    }

    static resolve(style: StyleProfile): PaletteMaterials {
        if (StylePalette.isPalette(style.palette)) return { ...palettes[style.palette] };
        return { ...palettes[fallbackPalette] };
    }

    static isPalette(value: string): value is PaletteName {
        return Object.prototype.hasOwnProperty.call(palettes, value);
    }
}

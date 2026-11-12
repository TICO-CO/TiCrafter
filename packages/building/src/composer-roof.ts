import type { StyleProfile } from './blueprint-document.js';
import type { BlueprintBlock } from './blueprint-ir.js';
import type { ComposerLayout } from './composer-layout.js';
import { MotifOutdoor } from './motif-outdoor.js';
import type { PaletteMaterials } from './style-palette.js';

export class ComposerRoof {
    static build(
        layout: ComposerLayout,
        palette: PaletteMaterials,
        style: StyleProfile,
    ): BlueprintBlock[] {
        const top = layout.storeys * layout.storeyHeight;
        const blocks = ComposerRoof.slab(layout, palette.roof, top);
        if (style.roof === 'flat') return blocks;
        const layers = Math.max(1, Math.floor(Math.min(layout.width, layout.depth) / 4));
        for (let layer = 0; layer < layers; layer += 1) {
            const inset = layer + 1;
            const y = top + layer + 1;
            if (style.roof === 'hip') {
                blocks.push(...ComposerRoof.hipLayer(layout, palette.roof, y, inset));
                continue;
            }
            blocks.push(...ComposerRoof.gableLayer(layout, palette.roof, y, inset));
        }
        return blocks;
    }

    private static slab(layout: ComposerLayout, material: string, y: number): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < layout.width; x += 1) {
            blocks.push(...MotifOutdoor.roofRow(x, y, 0, layout.depth - 1, material, 2));
        }
        return blocks;
    }

    private static gableLayer(
        layout: ComposerLayout,
        material: string,
        y: number,
        inset: number,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        const minimumZ = Math.min(inset, layout.depth - 1 - inset);
        for (let x = inset; x <= layout.width - 1 - inset; x += 1) {
            blocks.push(
                ...MotifOutdoor.roofRow(x, y, minimumZ, layout.depth - 1 - inset, material, 2),
            );
        }
        return blocks;
    }

    private static hipLayer(
        layout: ComposerLayout,
        material: string,
        y: number,
        inset: number,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = inset; x <= layout.width - 1 - inset; x += 1) {
            blocks.push(
                ...MotifOutdoor.roofRow(x, y, inset, layout.depth - 1 - inset, material, 2),
            );
        }
        return blocks;
    }
}

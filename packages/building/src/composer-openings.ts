import type { BlueprintBlock } from './blueprint-ir.js';
import { BlueprintIr } from './blueprint-ir.js';
import type { ComposerLayout, ComposerOpening } from './composer-layout.js';
import { MotifLibrary } from './motif-library.js';
import type { PaletteMaterials } from './style-palette.js';

type BlockMap = Map<string, BlueprintBlock>;

export class ComposerOpenings {
    static apply(blocks: BlockMap, layout: ComposerLayout, palette: PaletteMaterials): void {
        for (const opening of layout.openings) {
            blocks.delete(BlueprintIr.positionKey(opening));
            blocks.set(
                BlueprintIr.positionKey(opening),
                ComposerOpenings.block(opening, layout, palette),
            );
        }
    }

    private static block(
        opening: ComposerOpening,
        layout: ComposerLayout,
        palette: PaletteMaterials,
    ): BlueprintBlock {
        if (opening.kind === 'window') {
            return MotifLibrary.window(opening.x, opening.y, opening.z, palette.glass, 3);
        }
        const half = opening.y % layout.storeyHeight === 1 ? 'lower' : 'upper';
        return MotifLibrary.block(opening.x, opening.y, opening.z, palette.door, 3, {
            facing: opening.facing,
            half,
        });
    }
}

import type { BuildingBrief } from './blueprint-document.js';
import type { BlueprintBlock } from './blueprint-ir.js';
import { BlueprintIr } from './blueprint-ir.js';
import type { ComposerLayout, ComposerRoom } from './composer-layout.js';
import { MotifInterior } from './motif-interior.js';
import { MotifLibrary } from './motif-library.js';
import type { SeededRandom } from './seeded-random.js';
import type { PaletteMaterials } from './style-palette.js';

type BlockMap = Map<string, BlueprintBlock>;

export class ComposerInterior {
    static apply(
        blocks: BlockMap,
        layout: ComposerLayout,
        palette: PaletteMaterials,
        brief: BuildingBrief,
        random: SeededRandom,
    ): void {
        const amenities = new Set(brief.program.amenities);
        for (const room of layout.rooms) {
            ComposerInterior.furnish(blocks, room, palette, amenities);
        }
        ComposerInterior.decorate(blocks, layout, brief, random);
    }

    private static furnish(
        blocks: BlockMap,
        room: ComposerRoom,
        palette: PaletteMaterials,
        amenities: ReadonlySet<string>,
    ): void {
        if (room.width < 3 || room.depth < 3) return;
        const centerX = room.x + Math.floor(room.width / 2);
        const centerZ = room.z + Math.floor(room.depth / 2);
        ComposerInterior.place(blocks, MotifInterior.torch(centerX, 1, centerZ, 5));
        if (amenities.has('bed')) {
            ComposerInterior.bed(blocks, room);
        }
        if (amenities.has('chest')) {
            ComposerInterior.place(
                blocks,
                MotifInterior.chest(room.x + room.width - 2, 1, room.z + 1, 'south', 4),
            );
        }
        if (amenities.has('crafting_table')) {
            ComposerInterior.place(
                blocks,
                MotifInterior.craftingTable(room.x + 1, 1, room.z + room.depth - 2, 4),
            );
        }
        if (amenities.has('furnace')) {
            ComposerInterior.place(
                blocks,
                MotifInterior.furnace(
                    room.x + room.width - 2,
                    1,
                    room.z + room.depth - 2,
                    'north',
                    4,
                ),
            );
        }
        if (!amenities.has('torch')) return;
        ComposerInterior.place(blocks, MotifInterior.torch(centerX, 1, centerZ + 1, 5));
    }

    private static bed(blocks: BlockMap, room: ComposerRoom): void {
        const bed = MotifInterior.bed(room.x + 1, 1, room.z + 1, 'south', 'white_bed', 4);
        if (bed.some((block) => blocks.has(BlueprintIr.blockKey(block)))) return;
        bed.forEach((block) => blocks.set(BlueprintIr.blockKey(block), block));
    }

    private static decorate(
        blocks: BlockMap,
        layout: ComposerLayout,
        brief: BuildingBrief,
        random: SeededRandom,
    ): void {
        if (brief.style.decoration <= 0) return;
        const candidates: { x: number; z: number }[] = [];
        for (let x = 1; x < layout.width - 1; x += 1) {
            for (let z = 1; z < layout.depth - 1; z += 1) {
                if (blocks.has(BlueprintIr.positionKey({ x, y: 1, z }))) continue;
                if (!blocks.has(BlueprintIr.positionKey({ x, y: 0, z }))) continue;
                candidates.push({ x, z });
            }
        }
        if (candidates.length === 0) return;
        if (!random.chance(brief.style.decoration)) return;
        const selected = candidates[random.integer(0, candidates.length - 1)];
        if (selected === undefined) return;
        blocks.set(
            BlueprintIr.positionKey({ x: selected.x, y: 1, z: selected.z }),
            MotifLibrary.block(selected.x, 1, selected.z, 'flower_pot', 6),
        );
    }

    private static place(blocks: BlockMap, block: BlueprintBlock): void {
        const key = BlueprintIr.blockKey(block);
        if (blocks.has(key)) return;
        blocks.set(key, block);
    }
}

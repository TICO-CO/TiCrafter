import type { BlueprintBlock } from './blueprint-ir.js';
import { BlueprintIr } from './blueprint-ir.js';
import type { ComposerLayout, ComposerRoom } from './composer-layout.js';
import { MotifLibrary } from './motif-library.js';
import type { PaletteMaterials } from './style-palette.js';

type BlockMap = Map<string, BlueprintBlock>;

export class ComposerShell {
    static build(
        layout: ComposerLayout,
        palette: PaletteMaterials,
    ): ReadonlyMap<string, BlueprintBlock> {
        const blocks: BlockMap = new Map();
        for (let storey = 0; storey < layout.storeys; storey += 1) {
            const base = storey * layout.storeyHeight;
            ComposerShell.floor(layout, palette, base, storey).forEach((block) =>
                blocks.set(BlueprintIr.blockKey(block), block),
            );
            ComposerShell.perimeter(layout, palette, base).forEach((block) =>
                blocks.set(BlueprintIr.blockKey(block), block),
            );
            ComposerShell.interiorWalls(layout, palette, base).forEach((block) =>
                blocks.set(BlueprintIr.blockKey(block), block),
            );
            ComposerShell.ladder(layout, base).forEach((block) =>
                blocks.set(BlueprintIr.blockKey(block), block),
            );
        }
        return blocks;
    }

    private static floor(
        layout: ComposerLayout,
        palette: PaletteMaterials,
        base: number,
        storey: number,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < layout.width; x += 1) {
            for (let z = 0; z < layout.depth; z += 1) {
                if (storey > 0 && layout.stairwell?.x === x && layout.stairwell.z === z) {
                    continue;
                }
                blocks.push(MotifLibrary.block(x, base, z, palette.floor, 0));
            }
        }
        return blocks;
    }

    private static perimeter(
        layout: ComposerLayout,
        palette: PaletteMaterials,
        base: number,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let y = base + 1; y <= base + layout.wallHeight; y += 1) {
            for (let x = 0; x < layout.width; x += 1) {
                blocks.push(MotifLibrary.block(x, y, 0, palette.structure, 1));
                blocks.push(MotifLibrary.block(x, y, layout.depth - 1, palette.structure, 1));
            }
            for (let z = 1; z < layout.depth - 1; z += 1) {
                blocks.push(MotifLibrary.block(0, y, z, palette.structure, 1));
                blocks.push(MotifLibrary.block(layout.width - 1, y, z, palette.structure, 1));
            }
        }
        return blocks;
    }

    private static interiorWalls(
        layout: ComposerLayout,
        palette: PaletteMaterials,
        base: number,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (const [index, room] of layout.rooms.entries()) {
            const next = layout.rooms[index + 1];
            if (next !== undefined && ComposerShell.sameRow(room, next)) {
                ComposerShell.column(
                    blocks,
                    room.x + room.width,
                    room.z,
                    room.z + room.depth - 1,
                    base,
                    palette.structure,
                );
            }
            if (layout.corridorZ === null) continue;
            const boundary = room.z < layout.corridorZ ? room.z + room.depth - 1 : room.z;
            ComposerShell.row(
                blocks,
                boundary,
                room.x,
                room.x + room.width - 1,
                base,
                palette.structure,
            );
        }
        return blocks;
    }

    private static column(
        blocks: BlueprintBlock[],
        x: number,
        zStart: number,
        zEnd: number,
        base: number,
        material: string,
    ): void {
        for (let y = base + 1; y <= base + 3; y += 1) {
            for (let z = zStart; z <= zEnd; z += 1) {
                blocks.push(MotifLibrary.block(x, y, z, material, 1));
            }
        }
    }

    private static row(
        blocks: BlueprintBlock[],
        z: number,
        xStart: number,
        xEnd: number,
        base: number,
        material: string,
    ): void {
        for (let y = base + 1; y <= base + 3; y += 1) {
            for (let x = xStart; x <= xEnd; x += 1) {
                blocks.push(MotifLibrary.block(x, y, z, material, 1));
            }
        }
    }

    private static ladder(layout: ComposerLayout, base: number): BlueprintBlock[] {
        const stairwell = layout.stairwell;
        if (stairwell === null) return [];
        return Array.from({ length: layout.wallHeight }, (_, offset) =>
            MotifLibrary.ladder(stairwell.x, base + offset + 1, stairwell.z, 'east', 1),
        );
    }

    private static sameRow(room: ComposerRoom, next: ComposerRoom): boolean {
        return next.z === room.z && next.depth === room.depth;
    }
}

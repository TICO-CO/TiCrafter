import type { BlueprintBlock } from './blueprint-ir.js';
import { MotifBlock } from './motif-block.js';
import type { MotifFacing } from './motif-library.js';

export class MotifInterior {
    static bed(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        material: string,
        priority: number,
    ): BlueprintBlock[] {
        const head =
            facing === 'north'
                ? { x, z: z - 1 }
                : facing === 'south'
                  ? { x, z: z + 1 }
                  : facing === 'east'
                    ? { x: x + 1, z }
                    : { x: x - 1, z };
        return [
            MotifBlock.of(x, y, z, material, priority, { facing, part: 'foot' }),
            MotifBlock.of(head.x, y, head.z, material, priority, { facing, part: 'head' }),
        ];
    }

    static chest(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, 'chest', priority, { facing });
    }

    static craftingTable(x: number, y: number, z: number, priority: number): BlueprintBlock {
        return MotifBlock.of(x, y, z, 'crafting_table', priority);
    }

    static furnace(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, 'furnace', priority, { facing });
    }

    static torch(x: number, y: number, z: number, priority: number): BlueprintBlock {
        return MotifBlock.of(x, y, z, 'torch', priority);
    }

    static wallTorch(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        material: string,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority, { facing });
    }
}

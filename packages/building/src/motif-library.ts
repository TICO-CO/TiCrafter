import type { BlueprintBlock } from './blueprint-ir.js';
import { MotifBlock } from './motif-block.js';

export type MotifFacing = 'north' | 'south' | 'east' | 'west';
export type MotifAxis = 'x' | 'z';

export class MotifLibrary {
    static block(
        x: number,
        y: number,
        z: number,
        name: string,
        priority: number,
        properties?: Readonly<Record<string, string>>,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, name, priority, properties);
    }

    static door(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        material: string,
        priority: number,
    ): BlueprintBlock[] {
        return [
            MotifBlock.of(x, y, z, material, priority, { facing, half: 'lower' }),
            MotifBlock.of(x, y + 1, z, material, priority, { facing, half: 'upper' }),
        ];
    }

    static window(
        x: number,
        y: number,
        z: number,
        material: string,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority);
    }

    static windowRow(
        start: { x: number; y: number; z: number },
        length: number,
        axis: MotifAxis,
        material: string,
        priority: number,
    ): BlueprintBlock[] {
        return Array.from({ length }, (_, offset) =>
            MotifLibrary.window(
                start.x + (axis === 'x' ? offset : 0),
                start.y,
                start.z + (axis === 'z' ? offset : 0),
                material,
                priority,
            ),
        );
    }

    static stairs(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        material: string,
        priority: number,
        shape = 'straight',
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority, {
            facing,
            half: 'bottom',
            shape,
        });
    }

    static ladder(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, 'ladder', priority, { facing });
    }

    static railing(
        x: number,
        y: number,
        z: number,
        axis: MotifAxis,
        material: string,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority, { axis });
    }
}

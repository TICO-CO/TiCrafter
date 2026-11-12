import type { BlueprintBlock } from './blueprint-ir.js';
import { MotifBlock } from './motif-block.js';
import type { MotifFacing } from './motif-library.js';

export class MotifOutdoor {
    static farmPlot(
        x: number,
        y: number,
        z: number,
        crop: string,
        priority: number,
    ): BlueprintBlock[] {
        return [
            MotifBlock.of(x, y, z, 'farmland', priority, { moisture: '7' }),
            MotifBlock.of(x, y + 1, z, crop, priority, { age: '7' }),
        ];
    }

    static path(
        x: number,
        y: number,
        z: number,
        material: string,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority);
    }

    static fence(
        x: number,
        y: number,
        z: number,
        material: string,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority);
    }

    static gate(
        x: number,
        y: number,
        z: number,
        facing: MotifFacing,
        material: string,
        priority: number,
    ): BlueprintBlock {
        return MotifBlock.of(x, y, z, material, priority, { facing, open: 'false' });
    }

    static roofRow(
        x: number,
        y: number,
        zStart: number,
        zEnd: number,
        material: string,
        priority: number,
    ): BlueprintBlock[] {
        const low = Math.min(zStart, zEnd);
        const high = Math.max(zStart, zEnd);
        return Array.from({ length: high - low + 1 }, (_, offset) =>
            MotifBlock.of(x, y, low + offset, material, priority),
        );
    }
}

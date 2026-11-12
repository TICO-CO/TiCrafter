import type { BlueprintBlock, BlueprintBlockState } from './blueprint-ir.js';

export class MotifBlock {
    static of(
        x: number,
        y: number,
        z: number,
        name: string,
        priority: number,
        properties?: Readonly<Record<string, string>>,
    ): BlueprintBlock {
        const state: BlueprintBlockState =
            properties === undefined ? { name } : { name, properties };
        return { x, y, z, state, priority };
    }
}

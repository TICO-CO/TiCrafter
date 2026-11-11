import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class WallTemplate implements BuildingTemplate {
    readonly type = 'wall';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const length = TemplateGeometry.length(request, 8);
        const height = TemplateGeometry.height(request, 3);
        const thickness = TemplateGeometry.width(request, 1);
        const primary = TemplateGeometry.material(request, 'primary', 'stone_bricks');
        const blocks = this.wall(length, height, thickness, primary);
        return [{ blocks, materials: TemplateGeometry.materials(blocks), constraints: [] }, null];
    }

    private wall(
        length: number,
        height: number,
        thickness: number,
        material: string,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < length; x += 1) {
            for (let z = 0; z < thickness; z += 1) {
                for (let y = 0; y < height; y += 1) {
                    const crenellation = height > 1 && y === height - 1 && x % 2 === 1;
                    if (crenellation) continue;
                    blocks.push(TemplateGeometry.block(x, y, z, material, y === 0 ? 0 : 1));
                }
            }
        }
        return blocks;
    }
}

import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class FarmTemplate implements BuildingTemplate {
    readonly type = 'farm';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const width = TemplateGeometry.width(request, 9);
        const depth = TemplateGeometry.depth(request, 9);
        if (width < 3 || depth < 3) {
            return [
                null,
                {
                    type: 'TEMPLATE_FAILED',
                    templateType: this.type,
                    message: 'farm needs width and depth of at least three',
                },
            ];
        }
        const water = TemplateGeometry.material(request, 'water', 'water');
        const crop = TemplateGeometry.material(request, 'crop', 'wheat');
        const blocks = this.plot(width, depth, water, crop);
        return [{ blocks, materials: TemplateGeometry.materials(blocks), constraints: [] }, null];
    }

    private plot(width: number, depth: number, water: string, crop: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        const centerX = Math.floor(width / 2);
        const centerZ = Math.floor(depth / 2);
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                if (x === 0 || z === 0 || x === width - 1 || z === depth - 1) {
                    blocks.push(TemplateGeometry.block(x, 0, z, 'dirt_path', 0));
                    continue;
                }
                if (x === centerX && z === centerZ) {
                    blocks.push(TemplateGeometry.block(x, 0, z, water, 0));
                    continue;
                }
                blocks.push(TemplateGeometry.block(x, 0, z, 'farmland', 0, { moisture: '7' }));
                blocks.push(
                    TemplateGeometry.block(x, 1, z, crop, 1, {
                        age: String((x + z) % 7),
                    }),
                );
            }
        }
        return blocks;
    }
}

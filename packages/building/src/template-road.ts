import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class RoadTemplate implements BuildingTemplate {
    readonly type = 'road';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const length = TemplateGeometry.length(request, 8);
        const width = TemplateGeometry.width(request, 1);
        const primary = TemplateGeometry.material(request, 'primary', 'dirt_path');
        const secondary = TemplateGeometry.material(request, 'secondary', 'gravel');
        const blocks = this.segment(length, width, primary, secondary);
        return [{ blocks, materials: TemplateGeometry.materials(blocks), constraints: [] }, null];
    }

    private segment(
        length: number,
        width: number,
        primary: string,
        secondary: string,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        const startZ = -Math.floor(width / 2);
        for (let x = 0; x < length; x += 1) {
            for (let offset = 0; offset < width; offset += 1) {
                const material = offset === 0 || offset === width - 1 ? secondary : primary;
                blocks.push(TemplateGeometry.block(x, 0, startZ + offset, material, 0));
            }
        }
        return blocks;
    }
}

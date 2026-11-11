import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class BridgeTemplate implements BuildingTemplate {
    readonly type = 'bridge';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const length = TemplateGeometry.length(request, 8);
        const width = TemplateGeometry.width(request, 3);
        const deck = TemplateGeometry.material(request, 'primary', 'oak_planks');
        const support = TemplateGeometry.material(request, 'support', 'cobblestone');
        const rail = TemplateGeometry.material(request, 'rail', 'oak_fence');
        const blocks = [
            ...this.deck(length, width, deck),
            ...this.rails(length, width, rail),
            ...this.supports(length, width, support),
        ];
        return [{ blocks, materials: TemplateGeometry.materials(blocks), constraints: [] }, null];
    }

    private deck(length: number, width: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        const startZ = -Math.floor(width / 2);
        for (let x = 0; x < length; x += 1) {
            for (let offset = 0; offset < width; offset += 1) {
                blocks.push(TemplateGeometry.block(x, 0, startZ + offset, material, 0));
            }
        }
        return blocks;
    }

    private rails(length: number, width: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        const startZ = -Math.floor(width / 2);
        for (let x = 0; x < length; x += 1) {
            blocks.push(TemplateGeometry.block(x, 1, startZ, material, 2));
            if (width > 1) {
                blocks.push(TemplateGeometry.block(x, 1, startZ + width - 1, material, 2));
            }
        }
        return blocks;
    }

    private supports(length: number, width: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        const startZ = -Math.floor(width / 2);
        for (let x = 0; x < length; x += 4) {
            for (let offset = 0; offset < width; offset += 2) {
                blocks.push(TemplateGeometry.block(x, -1, startZ + offset, material, 0));
                blocks.push(TemplateGeometry.block(x, -2, startZ + offset, material, 0));
            }
        }
        return blocks;
    }
}

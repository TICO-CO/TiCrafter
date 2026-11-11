import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class StorageTemplate implements BuildingTemplate {
    readonly type = 'storage';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const width = TemplateGeometry.width(request, 7);
        const depth = TemplateGeometry.depth(request, 5);
        const height = TemplateGeometry.height(request, 3);
        const primary = TemplateGeometry.material(request, 'primary', 'oak_planks');
        const secondary = TemplateGeometry.material(request, 'secondary', 'cobblestone');
        const container = TemplateGeometry.material(request, 'container', 'chest');
        const blocks = [
            ...this.floor(width, depth, secondary),
            ...this.walls(width, depth, height, primary),
            ...this.roof(width, depth, height, secondary),
            ...this.containers(width, depth, container),
        ];
        return [{ blocks, materials: TemplateGeometry.materials(blocks), constraints: [] }, null];
    }

    private floor(width: number, depth: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                blocks.push(TemplateGeometry.block(x, 0, z, material, 0));
            }
        }
        return blocks;
    }

    private walls(
        width: number,
        depth: number,
        height: number,
        material: string,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let y = 1; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                blocks.push(TemplateGeometry.block(x, y, 0, material, 1));
                blocks.push(TemplateGeometry.block(x, y, depth - 1, material, 1));
            }
            for (let z = 1; z < depth - 1; z += 1) {
                blocks.push(TemplateGeometry.block(0, y, z, material, 1));
                blocks.push(TemplateGeometry.block(width - 1, y, z, material, 1));
            }
        }
        return blocks;
    }

    private roof(width: number, depth: number, height: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                blocks.push(TemplateGeometry.block(x, height, z, material, 2));
            }
        }
        return blocks;
    }

    private containers(width: number, depth: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 1; x < width - 1; x += 2) {
            blocks.push(TemplateGeometry.block(x, 1, depth - 2, material, 3, { facing: 'north' }));
        }
        return blocks;
    }
}

import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class WatchtowerTemplate implements BuildingTemplate {
    readonly type = 'watchtower';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const width = TemplateGeometry.width(request, 5);
        const depth = TemplateGeometry.depth(request, 5);
        const height = TemplateGeometry.height(request, 6);
        if (width < 3 || depth < 3) {
            return [
                null,
                {
                    type: 'TEMPLATE_FAILED',
                    templateType: this.type,
                    message: 'watchtower needs width and depth of at least three',
                },
            ];
        }
        const primary = TemplateGeometry.material(request, 'primary', 'stone_bricks');
        const secondary = TemplateGeometry.material(request, 'secondary', 'oak_planks');
        const blocks = this.tower(width, depth, height, primary, secondary);
        return [{ blocks, materials: TemplateGeometry.materials(blocks), constraints: [] }, null];
    }

    private tower(
        width: number,
        depth: number,
        height: number,
        primary: string,
        secondary: string,
    ): BlueprintBlock[] {
        const blocks = [
            ...this.base(width, depth, primary),
            ...this.shaft(width, depth, height, primary),
            ...this.platform(width, depth, height, secondary),
            ...this.access(height),
        ];
        const unique = new Map(blocks.map((block) => [`${block.x},${block.y},${block.z}`, block]));
        return [...unique.values()];
    }

    private base(width: number, depth: number, material: string): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                blocks.push(TemplateGeometry.block(x, 0, z, material, 0));
            }
        }
        return blocks;
    }

    private shaft(
        width: number,
        depth: number,
        height: number,
        material: string,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let y = 1; y < height - 1; y += 1) {
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

    private platform(
        width: number,
        depth: number,
        height: number,
        material: string,
    ): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                blocks.push(TemplateGeometry.block(x, height - 1, z, material, 2));
            }
        }
        const railY = height;
        for (let x = 0; x < width; x += 1) {
            blocks.push(TemplateGeometry.block(x, railY, 0, material, 3));
            blocks.push(TemplateGeometry.block(x, railY, depth - 1, material, 3));
        }
        for (let z = 1; z < depth - 1; z += 1) {
            blocks.push(TemplateGeometry.block(0, railY, z, material, 3));
            blocks.push(TemplateGeometry.block(width - 1, railY, z, material, 3));
        }
        return blocks;
    }

    private access(height: number): BlueprintBlock[] {
        const blocks: BlueprintBlock[] = [];
        for (let y = 1; y < height - 1; y += 1) {
            blocks.push(TemplateGeometry.block(0, y, 1, 'ladder', 3, { facing: 'east' }));
        }
        return blocks;
    }
}

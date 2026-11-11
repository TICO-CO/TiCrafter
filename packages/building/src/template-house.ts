import type { Result } from '@ticrafter/core';

import type { BlueprintBlock, BlueprintDraft } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BuildingTemplate,
    TemplateGeometry,
    type TemplateRequest,
} from './template-registry.js';

export class HouseTemplate implements BuildingTemplate {
    readonly type = 'house';

    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure> {
        const width = TemplateGeometry.width(request, 7);
        const depth = TemplateGeometry.depth(request, 7);
        const height = TemplateGeometry.height(request, 4);
        if (width < 3 || depth < 3 || height < 3) {
            return [
                null,
                {
                    type: 'TEMPLATE_FAILED',
                    templateType: this.type,
                    message: 'house needs width and depth of at least three and height of three',
                },
            ];
        }
        const primary = TemplateGeometry.material(request, 'primary', 'oak_planks');
        const secondary = TemplateGeometry.material(request, 'secondary', 'cobblestone');
        const roof = TemplateGeometry.material(request, 'roof', 'dark_oak_planks');
        const glass = TemplateGeometry.material(request, 'glass', 'glass');
        const doorX = Math.floor(width / 2);
        const doorZ = depth - 1;
        const windows = this.windows(width, depth, height, glass);
        const replaced = new Set(windows.map((block) => `${block.x},${block.y},${block.z}`));
        const walls = this.walls(width, depth, height, secondary).filter(
            (block) =>
                !(block.x === doorX && block.z === doorZ && (block.y === 1 || block.y === 2)) &&
                !replaced.has(`${block.x},${block.y},${block.z}`),
        );
        const blocks = [
            ...this.floor(width, depth, primary),
            ...walls,
            ...windows,
            ...this.roof(width, depth, height, roof),
            this.door(doorX, doorZ, 1, 'lower'),
            this.door(doorX, doorZ, 2, 'upper'),
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

    private windows(
        width: number,
        depth: number,
        height: number,
        material: string,
    ): BlueprintBlock[] {
        const windowY = Math.min(2, height - 1);
        const centerX = Math.floor(width / 2);
        const centerZ = Math.floor(depth / 2);
        return [
            TemplateGeometry.block(centerX, windowY, 0, material, 3),
            TemplateGeometry.block(0, windowY, centerZ, material, 3),
            TemplateGeometry.block(width - 1, windowY, centerZ, material, 3),
        ];
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

    private door(x: number, z: number, y: number, half: string): BlueprintBlock {
        return TemplateGeometry.block(x, y, z, 'oak_door', 3, { facing: 'north', half });
    }
}

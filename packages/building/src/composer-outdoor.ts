import type { Result } from '@ticrafter/core';

import type { BuildingBrief } from './blueprint-document.js';
import { type BlueprintBlock, type BlueprintDraft, BlueprintIr } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';
import { MotifLibrary } from './motif-library.js';
import { MotifOutdoor } from './motif-outdoor.js';
import type { PaletteMaterials } from './style-palette.js';

export type OutdoorKind = 'farm' | 'wall' | 'road' | 'bridge';

export interface OutdoorComposeRequest {
    kind: OutdoorKind;
    brief: BuildingBrief;
    palette: PaletteMaterials;
}

type BlockMap = Map<string, BlueprintBlock>;

export class ComposerOutdoor {
    static build(request: OutdoorComposeRequest): Result<BlueprintDraft, BuildingFailure> {
        const width = Math.floor(request.brief.size.width);
        const depth = Math.floor(request.brief.size.depth);
        if (width < 1 || depth < 1) {
            return [null, BuildingFailures.composeFailed('outdoor structure needs positive size')];
        }
        switch (request.kind) {
            case 'farm':
                return [ComposerOutdoor.farm(width, depth, request.palette), null];
            case 'wall':
                return [ComposerOutdoor.wall(width, depth, request.brief, request.palette), null];
            case 'road':
                return [ComposerOutdoor.road(width, depth, request.palette), null];
            case 'bridge':
                return [ComposerOutdoor.bridge(width, depth, request.palette), null];
        }
    }

    private static road(width: number, depth: number, palette: PaletteMaterials): BlueprintDraft {
        const blocks: BlockMap = new Map();
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                ComposerOutdoor.place(blocks, MotifOutdoor.path(x, 0, z, palette.path, 0));
            }
        }
        return ComposerOutdoor.draft(blocks);
    }

    private static wall(
        width: number,
        depth: number,
        brief: BuildingBrief,
        palette: PaletteMaterials,
    ): BlueprintDraft {
        const height = Math.max(3, Math.floor(brief.size.storeys) * 3);
        const blocks: BlockMap = new Map();
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                for (let y = 0; y < height; y += 1) {
                    ComposerOutdoor.place(
                        blocks,
                        MotifLibrary.block(x, y, z, palette.accent, y === 0 ? 0 : 1),
                    );
                }
            }
        }
        const gateX = Math.floor(width / 2);
        for (let z = 0; z < depth; z += 1) {
            blocks.delete(BlueprintIr.positionKey({ x: gateX, y: 1, z }));
            blocks.delete(BlueprintIr.positionKey({ x: gateX, y: 2, z }));
        }
        ComposerOutdoor.place(blocks, MotifOutdoor.gate(gateX, 1, 0, 'south', palette.gate, 3));
        return ComposerOutdoor.draft(blocks);
    }

    private static bridge(width: number, depth: number, palette: PaletteMaterials): BlueprintDraft {
        const blocks: BlockMap = new Map();
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                ComposerOutdoor.place(blocks, MotifLibrary.block(x, 0, z, palette.floor, 0));
            }
            ComposerOutdoor.place(blocks, MotifOutdoor.fence(x, 1, 0, palette.fence, 1));
            ComposerOutdoor.place(blocks, MotifOutdoor.fence(x, 1, depth - 1, palette.fence, 1));
        }
        return ComposerOutdoor.draft(blocks);
    }

    private static farm(width: number, depth: number, palette: PaletteMaterials): BlueprintDraft {
        const blocks: BlockMap = new Map();
        for (let x = 0; x < width; x += 1) {
            for (let z = 0; z < depth; z += 1) {
                ComposerOutdoor.farmCell(blocks, x, z, width, depth, palette);
            }
        }
        ComposerOutdoor.fencePerimeter(blocks, width, depth, palette);
        return ComposerOutdoor.draft(blocks);
    }

    private static farmCell(
        blocks: BlockMap,
        x: number,
        z: number,
        width: number,
        depth: number,
        palette: PaletteMaterials,
    ): void {
        const perimeter = x === 0 || z === 0 || x === width - 1 || z === depth - 1;
        if (perimeter) {
            ComposerOutdoor.place(blocks, MotifOutdoor.path(x, 0, z, palette.path, 0));
            return;
        }
        if (z % 4 === 0) {
            ComposerOutdoor.place(blocks, MotifLibrary.block(x, 0, z, 'water', 0));
            return;
        }
        MotifOutdoor.farmPlot(x, 0, z, palette.crop, 0).forEach((block) =>
            ComposerOutdoor.place(blocks, block),
        );
    }

    private static fencePerimeter(
        blocks: BlockMap,
        width: number,
        depth: number,
        palette: PaletteMaterials,
    ): void {
        for (let x = 0; x < width; x += 1) {
            ComposerOutdoor.place(blocks, MotifOutdoor.fence(x, 1, 0, palette.fence, 1));
            ComposerOutdoor.place(blocks, MotifOutdoor.fence(x, 1, depth - 1, palette.fence, 1));
        }
        for (let z = 1; z < depth - 1; z += 1) {
            ComposerOutdoor.place(blocks, MotifOutdoor.fence(0, 1, z, palette.fence, 1));
            ComposerOutdoor.place(blocks, MotifOutdoor.fence(width - 1, 1, z, palette.fence, 1));
        }
        ComposerOutdoor.place(
            blocks,
            MotifOutdoor.gate(Math.floor(width / 2), 1, depth - 1, 'north', palette.gate, 3),
        );
    }

    private static place(blocks: BlockMap, block: BlueprintBlock): void {
        blocks.set(BlueprintIr.blockKey(block), block);
    }

    private static draft(blocks: BlockMap): BlueprintDraft {
        const values = [...blocks.values()];
        return {
            blocks: values,
            materials: BlueprintIr.materialNeeds(values),
            constraints: [],
        };
    }
}

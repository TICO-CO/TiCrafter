import type { Result } from '@ticrafter/core';

import {
    type Blueprint,
    type BlueprintBlock,
    type BlueprintBoundingBox,
    BlueprintIr,
} from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';

export interface ObservedBlueprintRequest {
    id: string;
    bounds: BlueprintBoundingBox;
}

export interface ObservedBlueprintCaptureOptions {
    world: WorldBlockQueryPort;
    maxBlocks?: number;
}

const defaultMaxBlocks = 4000;

export class ObservedBlueprintCapture {
    private readonly maxBlocks: number;

    constructor(private readonly options: ObservedBlueprintCaptureOptions) {
        this.maxBlocks = options.maxBlocks ?? defaultMaxBlocks;
    }

    capture(request: ObservedBlueprintRequest): Result<Blueprint, BuildingFailure> {
        if (request.id.trim().length === 0) {
            return [null, BuildingFailures.observationFailed('blueprint id is empty')];
        }
        const [blocks, blocksError] = this.blocks(request.bounds);
        if (blocksError) return [null, blocksError];
        if (blocks === null) {
            return [null, BuildingFailures.observationFailed('observation returned no blocks')];
        }
        if (blocks.length === 0) {
            return [null, BuildingFailures.observationFailed('observed region is empty')];
        }
        if (blocks.length > this.maxBlocks) {
            return [
                null,
                BuildingFailures.observationFailed(
                    `observed ${blocks.length} blocks, limit is ${this.maxBlocks}`,
                ),
            ];
        }
        return [
            {
                id: request.id,
                anchor: request.bounds.min,
                rotation: 0,
                blocks,
                materials: BlueprintIr.materialNeeds(blocks),
                constraints: [],
            },
            null,
        ];
    }

    private blocks(
        bounds: BlueprintBoundingBox,
    ): Result<readonly BlueprintBlock[], BuildingFailure> {
        if (this.options.world.blocksInBox !== undefined) {
            const [positioned, positionedError] = this.options.world.blocksInBox(bounds);
            if (positionedError) return [null, positionedError];
            if (positioned === null) {
                return [null, BuildingFailures.observationFailed('world query returned no blocks')];
            }
            return [
                positioned
                    .filter((block) => !BlueprintIr.isAir(block.name))
                    .map((block) => this.block(block.position, block)),
                null,
            ];
        }
        return this.scan(bounds);
    }

    private scan(bounds: BlueprintBoundingBox): Result<readonly BlueprintBlock[], BuildingFailure> {
        const blocks: BlueprintBlock[] = [];
        for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
            for (let y = bounds.min.y; y <= bounds.max.y; y += 1) {
                for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
                    const [block, blockError] = this.options.world.blockAt({ x, y, z });
                    if (blockError) return [null, blockError];
                    if (block === null || BlueprintIr.isAir(block.name)) continue;
                    blocks.push(this.block({ x, y, z }, block));
                }
            }
        }
        return [blocks, null];
    }

    private block(
        position: { x: number; y: number; z: number },
        block: WorldBlockState,
    ): BlueprintBlock {
        const state =
            block.properties === undefined
                ? { name: block.name }
                : { name: block.name, properties: block.properties };
        return { ...position, state, priority: 0 };
    }
}

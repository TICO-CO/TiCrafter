import type { Result, Vec3 } from '@ticrafter/core';

import {
    type Blueprint,
    type BlueprintBlock,
    type BlueprintBlockState,
    type BlueprintBoundingBox,
    BlueprintIr,
} from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export interface WorldBlockState {
    name: string;
    properties?: Readonly<Record<string, string>>;
}

export interface PositionedWorldBlock extends WorldBlockState {
    position: Vec3;
}

export interface WorldBlockQueryPort {
    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure>;
    blocksInBox?(
        bounds: BlueprintBoundingBox,
    ): Result<readonly PositionedWorldBlock[], BuildingFailure>;
}

export interface SchematicDiff {
    missing: readonly BlueprintBlock[];
    extra: readonly Vec3[];
    mismatched: readonly BlueprintBlock[];
    satisfied: readonly BlueprintBlock[];
}

export class SchematicDiffCalculator {
    diff(blueprint: Blueprint, world: WorldBlockQueryPort): Result<SchematicDiff, BuildingFailure> {
        const expected = new Map<string, BlueprintBlock>();
        const missing: BlueprintBlock[] = [];
        const mismatched: BlueprintBlock[] = [];
        const satisfied: BlueprintBlock[] = [];
        for (const block of blueprint.blocks) {
            if (BlueprintIr.isAir(block.state.name)) continue;
            expected.set(BlueprintIr.blockKey(block), block);
            const [actual, actualError] = world.blockAt(BlueprintIr.position(block));
            if (actualError) return [null, actualError];
            if (actual === null || BlueprintIr.isAir(actual.name)) {
                missing.push(block);
                continue;
            }
            if (this.matches(block.state, actual)) {
                satisfied.push(block);
                continue;
            }
            mismatched.push(block);
        }
        const [extra, extraError] = this.extraBlocks(blueprint, expected, world);
        if (extraError) return [null, extraError];
        if (extra === null) return [null, { type: 'WORLD_QUERY_FAILED', message: 'no extras' }];
        return [{ missing, extra, mismatched, satisfied }, null];
    }

    private matches(expected: BlueprintBlockState, actual: WorldBlockState): boolean {
        if (expected.name !== actual.name) return false;
        if (expected.properties === undefined) return true;
        const actualProperties = actual.properties ?? {};
        return Object.entries(expected.properties).every(
            ([key, value]) => actualProperties[key] === value,
        );
    }

    private extraBlocks(
        blueprint: Blueprint,
        expected: ReadonlyMap<string, BlueprintBlock>,
        world: WorldBlockQueryPort,
    ): Result<readonly Vec3[], BuildingFailure> {
        if (world.blocksInBox === undefined) return [[], null];
        const [bounds, boundsError] = BlueprintIr.boundingBox(blueprint.blocks);
        if (boundsError) return [null, boundsError];
        if (bounds === null) return [[], null];
        const [blocks, blocksError] = world.blocksInBox(bounds);
        if (blocksError) return [null, blocksError];
        if (blocks === null) return [[], null];
        return [
            blocks
                .filter(
                    (block) =>
                        !BlueprintIr.isAir(block.name) &&
                        !expected.has(BlueprintIr.positionKey(block.position)),
                )
                .map((block) => block.position),
            null,
        ];
    }
}

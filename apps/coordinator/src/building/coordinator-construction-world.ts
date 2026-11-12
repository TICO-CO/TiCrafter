import {
    type BuildingFailure,
    BuildingFailures,
    type PositionedWorldBlock,
    type WorldBlockQueryPort,
    type WorldBlockState,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';
import type { ChunkBlockObservation, WorldFailure } from '@ticrafter/worldmodel';
import type { BlockPosition, BoundingBox } from '@ticrafter/worldmodel';

interface ConstructionWorldQuery {
    blockAt(position: BlockPosition): Result<ChunkBlockObservation | null, WorldFailure>;
    blocksInBox(bounds: BoundingBox): Result<readonly ChunkBlockObservation[], WorldFailure>;
}

export class CoordinatorConstructionWorld implements WorldBlockQueryPort {
    constructor(private readonly world: ConstructionWorldQuery) {}

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        const [block, blockError] = this.world.blockAt(position);
        if (blockError) {
            return [
                null,
                BuildingFailures.worldQueryFailed(
                    CoordinatorConstructionWorld.describe(blockError),
                ),
            ];
        }
        if (block === null) return [null, null];
        return [{ name: block.blockId }, null];
    }

    blocksInBox(bounds: {
        min: Vec3;
        max: Vec3;
    }): Result<readonly PositionedWorldBlock[], BuildingFailure> {
        const [blocks, blockError] = this.world.blocksInBox(bounds);
        if (blockError) {
            return [
                null,
                BuildingFailures.worldQueryFailed(
                    CoordinatorConstructionWorld.describe(blockError),
                ),
            ];
        }
        return [
            (blocks ?? []).map((block) => ({
                name: block.blockId,
                position: block.position,
            })),
            null,
        ];
    }

    private static describe(failure: { type: string }): string {
        return failure.type;
    }
}

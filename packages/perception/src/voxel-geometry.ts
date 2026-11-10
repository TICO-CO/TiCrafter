import type { DetectionBoundingBox, VoxelBlock, VoxelPosition } from './types.js';

export class VoxelGeometry {
    static inside(position: VoxelPosition, bounds: DetectionBoundingBox): boolean {
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
        );
    }

    static center(bounds: DetectionBoundingBox): VoxelPosition {
        return {
            x: Math.floor((bounds.min.x + bounds.max.x) / 2),
            y: Math.floor((bounds.min.y + bounds.max.y) / 2),
            z: Math.floor((bounds.min.z + bounds.max.z) / 2),
        };
    }

    static materials(
        blocks: readonly VoxelBlock[],
        bounds: DetectionBoundingBox,
    ): readonly string[] {
        return [
            ...new Set(
                blocks
                    .filter((block) => block.solid && VoxelGeometry.inside(block.position, bounds))
                    .map((block) => block.blockId),
            ),
        ].sort();
    }

    static byPosition(blocks: readonly VoxelBlock[]): ReadonlyMap<string, VoxelBlock> {
        const blocksByPosition = new Map<string, VoxelBlock>();
        blocks.forEach((block) => {
            blocksByPosition.set(VoxelGeometry.key(block), block);
        });
        return blocksByPosition;
    }

    static isStandable(
        block: VoxelBlock,
        blocksByPosition: ReadonlyMap<string, VoxelBlock>,
    ): boolean {
        if (!block.solid) return false;
        return (
            !VoxelGeometry.isSolidAt(
                blocksByPosition,
                block.position.x,
                block.position.y + 1,
                block.position.z,
            ) &&
            !VoxelGeometry.isSolidAt(
                blocksByPosition,
                block.position.x,
                block.position.y + 2,
                block.position.z,
            )
        );
    }

    private static isSolidAt(
        blocksByPosition: ReadonlyMap<string, VoxelBlock>,
        x: number,
        y: number,
        z: number,
    ): boolean {
        return blocksByPosition.get(`${x},${y},${z}`)?.solid === true;
    }

    private static key(block: VoxelBlock): string {
        return `${block.position.x},${block.position.y},${block.position.z}`;
    }
}

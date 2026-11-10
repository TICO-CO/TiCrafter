import type { VoxelBlock } from './types.js';

export class VoxelGeometry {
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

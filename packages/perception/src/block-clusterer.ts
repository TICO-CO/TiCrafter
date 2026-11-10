import type { DetectionBoundingBox, VoxelBlock, VoxelPosition } from './types.js';

export interface BlockCluster {
    blocks: readonly VoxelBlock[];
    bounds: DetectionBoundingBox;
}

interface ClusterOffset {
    x: number;
    y: number;
    z: number;
}

const horizontalOffsets: readonly ClusterOffset[] = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];

export class BlockClusterer {
    static connected(blocks: readonly VoxelBlock[], maximumDistance = 1): readonly BlockCluster[] {
        return BlockClusterer.cluster(blocks, BlockClusterer.offsets(maximumDistance));
    }

    static horizontal(blocks: readonly VoxelBlock[]): readonly BlockCluster[] {
        return BlockClusterer.cluster(blocks, horizontalOffsets);
    }

    static bounds(blocks: readonly VoxelBlock[]): DetectionBoundingBox | null {
        return BlockClusterer.boundsOfPositions(blocks.map((block) => block.position));
    }

    static boundsOfPositions(positions: readonly VoxelPosition[]): DetectionBoundingBox | null {
        const [first, ...rest] = positions;
        if (first === undefined) return null;
        return rest.reduce<DetectionBoundingBox>(
            (bounds, position) => ({
                min: {
                    x: Math.min(bounds.min.x, position.x),
                    y: Math.min(bounds.min.y, position.y),
                    z: Math.min(bounds.min.z, position.z),
                },
                max: {
                    x: Math.max(bounds.max.x, position.x),
                    y: Math.max(bounds.max.y, position.y),
                    z: Math.max(bounds.max.z, position.z),
                },
            }),
            {
                min: { ...first },
                max: { ...first },
            },
        );
    }

    private static cluster(
        blocks: readonly VoxelBlock[],
        offsets: readonly ClusterOffset[],
    ): readonly BlockCluster[] {
        const remaining = new Map(
            blocks.map((block) => [BlockClusterer.key(block.position), block]),
        );
        const clusters: BlockCluster[] = [];
        blocks.forEach((block) => {
            if (!remaining.has(BlockClusterer.key(block.position))) return;
            const component = BlockClusterer.collect(remaining, block, offsets);
            const bounds = BlockClusterer.bounds(component);
            if (bounds !== null) clusters.push({ blocks: component, bounds });
        });
        return clusters;
    }

    private static collect(
        remaining: Map<string, VoxelBlock>,
        seed: VoxelBlock,
        offsets: readonly ClusterOffset[],
    ): readonly VoxelBlock[] {
        const stack: VoxelBlock[] = [seed];
        const component: VoxelBlock[] = [];
        remaining.delete(BlockClusterer.key(seed.position));
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined) break;
            component.push(current);
            offsets.forEach((offset) => {
                const position = {
                    x: current.position.x + offset.x,
                    y: current.position.y + offset.y,
                    z: current.position.z + offset.z,
                };
                const neighbor = remaining.get(BlockClusterer.key(position));
                if (neighbor === undefined) return;
                remaining.delete(BlockClusterer.key(position));
                stack.push(neighbor);
            });
        }
        return component;
    }

    private static offsets(maximumDistance: number): readonly ClusterOffset[] {
        const offsets: ClusterOffset[] = [];
        for (let x = -maximumDistance; x <= maximumDistance; x += 1) {
            for (let y = -maximumDistance; y <= maximumDistance; y += 1) {
                for (let z = -maximumDistance; z <= maximumDistance; z += 1) {
                    if (x === 0 && y === 0 && z === 0) continue;
                    offsets.push({ x, y, z });
                }
            }
        }
        return offsets;
    }

    private static key(position: VoxelPosition): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

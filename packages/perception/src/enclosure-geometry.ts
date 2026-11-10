import { BlockClusterer } from './block-clusterer.js';
import type { DetectionBoundingBox, VoxelBlock, VoxelPosition } from './types.js';

export interface EnclosedRegion {
    positions: readonly VoxelPosition[];
    bounds: DetectionBoundingBox;
}

interface FloodResult {
    positions: readonly VoxelPosition[];
    touchesBoundary: boolean;
}

const neighborOffsets: readonly VoxelPosition[] = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];

export class EnclosureGeometry {
    static enclosedRegions(
        blocks: readonly VoxelBlock[],
        minimumVolume: number,
        isBarrier: (block: VoxelBlock) => boolean = (block) => block.solid,
    ): readonly EnclosedRegion[] {
        const bounds = BlockClusterer.bounds(blocks);
        if (bounds === null) return [];
        const barriers = new Set(
            blocks
                .filter((block) => isBarrier(block))
                .map((block) => EnclosureGeometry.key(block.position)),
        );
        const visited = new Set<string>();
        const regions: EnclosedRegion[] = [];
        for (const position of EnclosureGeometry.positionsIn(bounds)) {
            EnclosureGeometry.visit(position, bounds, barriers, visited, minimumVolume, regions);
        }
        return regions;
    }

    private static positionsIn(bounds: DetectionBoundingBox): readonly VoxelPosition[] {
        const width = bounds.max.x - bounds.min.x + 1;
        const height = bounds.max.y - bounds.min.y + 1;
        const depth = bounds.max.z - bounds.min.z + 1;
        const positions: VoxelPosition[] = [];
        for (let index = 0; index < width * height * depth; index += 1) {
            positions.push(EnclosureGeometry.positionAt(index, bounds, width, depth));
        }
        return positions;
    }

    private static positionAt(
        index: number,
        bounds: DetectionBoundingBox,
        width: number,
        depth: number,
    ): VoxelPosition {
        return {
            x: bounds.min.x + (index % width),
            y: bounds.min.y + Math.floor(index / (width * depth)),
            z: bounds.min.z + (Math.floor(index / width) % depth),
        };
    }

    private static visit(
        position: VoxelPosition,
        bounds: DetectionBoundingBox,
        barriers: ReadonlySet<string>,
        visited: Set<string>,
        minimumVolume: number,
        regions: EnclosedRegion[],
    ): void {
        const key = EnclosureGeometry.key(position);
        if (barriers.has(key) || visited.has(key)) return;
        const result = EnclosureGeometry.flood(position, bounds, barriers, visited);
        if (result.touchesBoundary || result.positions.length < minimumVolume) return;
        const regionBounds = BlockClusterer.boundsOfPositions(result.positions);
        if (regionBounds === null) return;
        regions.push({ positions: result.positions, bounds: regionBounds });
    }

    private static flood(
        seed: VoxelPosition,
        bounds: DetectionBoundingBox,
        barriers: ReadonlySet<string>,
        visited: Set<string>,
    ): FloodResult {
        const stack: VoxelPosition[] = [seed];
        const positions: VoxelPosition[] = [];
        let touchesBoundary = false;
        visited.add(EnclosureGeometry.key(seed));
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined) break;
            positions.push(current);
            if (EnclosureGeometry.onBoundary(current, bounds)) touchesBoundary = true;
            neighborOffsets.forEach((offset) => {
                const neighbor = {
                    x: current.x + offset.x,
                    y: current.y + offset.y,
                    z: current.z + offset.z,
                };
                if (!EnclosureGeometry.inside(neighbor, bounds)) return;
                const key = EnclosureGeometry.key(neighbor);
                if (barriers.has(key) || visited.has(key)) return;
                visited.add(key);
                stack.push(neighbor);
            });
        }
        return { positions, touchesBoundary };
    }

    private static inside(position: VoxelPosition, bounds: DetectionBoundingBox): boolean {
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
        );
    }

    private static onBoundary(position: VoxelPosition, bounds: DetectionBoundingBox): boolean {
        return (
            position.x === bounds.min.x ||
            position.x === bounds.max.x ||
            position.y === bounds.min.y ||
            position.y === bounds.max.y ||
            position.z === bounds.min.z ||
            position.z === bounds.max.z
        );
    }

    private static key(position: VoxelPosition): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

import { type BlockCluster, BlockClusterer } from './block-clusterer.js';
import type { VoxelBlock } from './types.js';

const cropIds = new Set([
    'wheat',
    'carrots',
    'potatoes',
    'beetroots',
    'pumpkin_stem',
    'melon_stem',
    'torchflower_crop',
    'pitcher_crop',
]);

export interface FarmPlot {
    farmland: readonly VoxelBlock[];
    bounds: BlockCluster['bounds'];
}

export class FarmPlotGeometry {
    static plots(blocks: readonly VoxelBlock[]): readonly FarmPlot[] {
        const farmland = blocks.filter((block) => FarmPlotGeometry.isFarmland(block));
        return BlockClusterer.horizontal(farmland).map((cluster) => ({
            farmland: cluster.blocks,
            bounds: cluster.bounds,
        }));
    }

    static isFarmland(block: VoxelBlock): boolean {
        return block.blockId === 'farmland';
    }

    static isCrop(block: VoxelBlock): boolean {
        return cropIds.has(block.blockId);
    }

    static isWater(block: VoxelBlock): boolean {
        return block.blockId.includes('water');
    }

    static cropsAbove(
        plot: FarmPlot,
        blocksByPosition: ReadonlyMap<string, VoxelBlock>,
    ): readonly VoxelBlock[] {
        return plot.farmland.flatMap((farmland) => {
            const above = blocksByPosition.get(
                FarmPlotGeometry.key({
                    x: farmland.position.x,
                    y: farmland.position.y + 1,
                    z: farmland.position.z,
                }),
            );
            return above !== undefined && FarmPlotGeometry.isCrop(above) ? [above] : [];
        });
    }

    static waterNear(plot: FarmPlot, blocks: readonly VoxelBlock[]): readonly VoxelBlock[] {
        const water = blocks.filter((block) => FarmPlotGeometry.isWater(block));
        return water.filter((source) =>
            plot.farmland.some((farmland) => FarmPlotGeometry.hydrates(farmland, source)),
        );
    }

    static moistureLevel(block: VoxelBlock): number | null {
        return FarmPlotGeometry.numericProperty(block, 'moisture');
    }

    static age(block: VoxelBlock): number | null {
        return FarmPlotGeometry.numericProperty(block, 'age');
    }

    static key(position: { x: number; y: number; z: number }): string {
        return `${position.x},${position.y},${position.z}`;
    }

    private static hydrates(farmland: VoxelBlock, water: VoxelBlock): boolean {
        return (
            Math.abs(farmland.position.x - water.position.x) <= 4 &&
            Math.abs(farmland.position.z - water.position.z) <= 4 &&
            Math.abs(farmland.position.y - water.position.y) <= 1
        );
    }

    private static numericProperty(block: VoxelBlock, name: string): number | null {
        const raw = block.properties?.[name];
        if (raw === undefined) return null;
        const value = Number.parseInt(raw, 10);
        return Number.isNaN(value) ? null : value;
    }
}

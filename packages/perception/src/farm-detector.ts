import { type FarmPlot, FarmPlotGeometry } from './farm-plot.js';
import type { ChunkSnapshot, DetectionCandidate, DetectorPort, VoxelBlock } from './types.js';
import { VoxelGeometry } from './voxel-geometry.js';

export class FarmDetector implements DetectorPort {
    readonly id = 'farm';

    constructor(private readonly minimumPlotSize = 3) {}

    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        const blocksByPosition = new Map(
            snapshot.blocks.map((block) => [FarmPlotGeometry.key(block.position), block]),
        );
        return FarmPlotGeometry.plots(snapshot.blocks)
            .filter((plot) => plot.farmland.length >= this.minimumPlotSize)
            .map((plot) => FarmDetector.candidate(plot, snapshot.blocks, blocksByPosition));
    }

    private static candidate(
        plot: FarmPlot,
        blocks: readonly VoxelBlock[],
        blocksByPosition: ReadonlyMap<string, VoxelBlock>,
    ): DetectionCandidate {
        const size = plot.farmland.length;
        const crops = FarmPlotGeometry.cropsAbove(plot, blocksByPosition);
        const water = FarmPlotGeometry.waterNear(plot, blocks);
        const moistureLevels = plot.farmland
            .map((farmland) => FarmPlotGeometry.moistureLevel(farmland))
            .filter((level): level is number => level !== null);
        const hydrated =
            moistureLevels.length === 0
                ? water.length > 0
                    ? size
                    : 0
                : moistureLevels.filter((level) => level > 0).length;
        const averageAge = FarmDetector.averageAge(crops);
        const bbox = {
            min: plot.bounds.min,
            max: {
                x: plot.bounds.max.x,
                y: crops.length > 0 ? plot.bounds.max.y + 1 : plot.bounds.max.y,
                z: plot.bounds.max.z,
            },
        };
        const anchors = [
            { name: 'center', position: VoxelGeometry.center(plot.bounds) },
            ...(water[0] === undefined ? [] : [{ name: 'water', position: water[0].position }]),
        ];
        return {
            detectorId: 'farm',
            type: 'farm',
            bbox,
            anchors,
            confidence: FarmDetector.confidence(size, hydrated, water.length, crops.length),
            evidence: `farmland blocks ${size} hydrated ${hydrated} water ${water.length} crops ${crops.length} average age ${averageAge.toFixed(1)}`,
        };
    }

    private static averageAge(crops: readonly VoxelBlock[]): number {
        const ages = crops
            .map((crop) => FarmPlotGeometry.age(crop))
            .filter((age): age is number => age !== null);
        if (ages.length === 0) return 0;
        return ages.reduce((total, age) => total + age, 0) / ages.length;
    }

    private static confidence(
        size: number,
        hydrated: number,
        waterCount: number,
        cropCount: number,
    ): number {
        const hydrationRatio = hydrated / Math.max(size, 1);
        const waterBonus = waterCount > 0 ? 0.1 : 0;
        const cropBonus = cropCount > 0 ? 0.1 : 0;
        return Math.min(
            0.95,
            0.5 + Math.min(size, 9) / 30 + hydrationRatio * 0.05 + waterBonus + cropBonus,
        );
    }
}

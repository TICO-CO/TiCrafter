import type { Result, Vec3 } from '@ticrafter/core';
import type { DetectionCandidate } from '@ticrafter/perception';
import type { SkillBBox, SkillBlock, SkillFarmPlot, SkillFarmPlotSource } from '@ticrafter/skills';

export interface FarmPlotWorldPort {
    blocksInBox(bbox: SkillBBox): readonly SkillBlock[];
}

export interface FarmPlotRegistryOptions {
    world: FarmPlotWorldPort;
    maximumPlots?: number;
}

export interface FarmPlotSnapshot {
    id: string;
    bbox: SkillBBox;
    cropBlockIds?: readonly string[];
    seedItem?: string;
    lastSeenAt: number;
}

const CROP_SEEDS: Readonly<Record<string, string>> = {
    beetroots: 'beetroot_seeds',
    carrots: 'carrot',
    melon: 'melon_seeds',
    nether_wart: 'nether_wart',
    potatoes: 'potato',
    pumpkin: 'pumpkin_seeds',
    sweet_berry_bush: 'sweet_berries',
    wheat: 'wheat_seeds',
};

const CROP_IDS = new Set(Object.keys(CROP_SEEDS));
const DEFAULT_MAXIMUM_PLOTS = 128;

export class FarmPlotRegistry implements SkillFarmPlotSource {
    private readonly plots = new Map<string, FarmPlotSnapshot>();
    private sequence = 0;

    constructor(private readonly options: FarmPlotRegistryOptions) {}

    observe(candidate: DetectionCandidate, now = Date.now()): FarmPlotSnapshot | null {
        if (candidate.type !== 'farm') return null;
        const id = FarmPlotRegistry.plotId(candidate.bbox);
        const bbox = {
            min: { ...candidate.bbox.min },
            max: { ...candidate.bbox.max },
        };
        const cropBlockIds = this.cropBlockIds(bbox);
        const seedItem =
            cropBlockIds.map((crop) => CROP_SEEDS[crop]).find((seed) => seed !== undefined) ??
            undefined;
        const plot: FarmPlotSnapshot = {
            id,
            bbox,
            ...(cropBlockIds.length === 0 ? {} : { cropBlockIds }),
            ...(seedItem === undefined ? {} : { seedItem }),
            lastSeenAt: now,
        };
        this.plots.set(id, plot);
        this.sequence += 1;
        this.prune();
        return plot;
    }

    getPlot(plotId: string): Result<SkillFarmPlot | null, string> {
        const plot = this.plots.get(plotId);
        if (plot === undefined) return [null, null];
        return [
            {
                id: plot.id,
                bbox: plot.bbox,
                ...(plot.cropBlockIds === undefined ? {} : { cropBlockIds: plot.cropBlockIds }),
                ...(plot.seedItem === undefined ? {} : { seedItem: plot.seedItem }),
            },
            null,
        ];
    }

    list(): readonly FarmPlotSnapshot[] {
        return [...this.plots.values()].sort((left, right) => right.lastSeenAt - left.lastSeenAt);
    }

    remove(plotId: string): boolean {
        return this.plots.delete(plotId);
    }

    clear(): void {
        this.plots.clear();
    }

    private cropBlockIds(bbox: SkillBBox): readonly string[] {
        const crops = new Set<string>();
        for (const block of this.options.world.blocksInBox(bbox)) {
            if (CROP_IDS.has(block.name)) crops.add(block.name);
        }
        return [...crops].sort();
    }

    private prune(): void {
        const maximum = this.options.maximumPlots ?? DEFAULT_MAXIMUM_PLOTS;
        if (this.plots.size <= maximum) return;
        const oldest = [...this.plots.values()].sort(
            (left, right) => left.lastSeenAt - right.lastSeenAt,
        )[0];
        if (oldest !== undefined) this.plots.delete(oldest.id);
    }

    private static plotId(bbox: { min: Vec3; max: Vec3 }): string {
        return `farm.${bbox.min.x}.${bbox.min.y}.${bbox.min.z}`;
    }
}

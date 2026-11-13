import type { Vec3 } from '@ticrafter/core';

export interface VillageObservation {
    villagers: readonly Vec3[];
    beds: readonly Vec3[];
    doors: readonly Vec3[];
    workstations: readonly Vec3[];
    farmland: readonly Vec3[];
}

export interface VillageCandidate {
    id: string;
    min: Vec3;
    max: Vec3;
    villagers: number;
    beds: number;
    doors: number;
    workstations: number;
    farmland: number;
    confidence: number;
}

export interface VillageScannerOptions {
    clusterRadius: number;
    minimumVillagers: number;
    minimumStructures: number;
}

const DEFAULTS: VillageScannerOptions = {
    clusterRadius: 16,
    minimumVillagers: 2,
    minimumStructures: 3,
};

export class VillageScanner {
    private readonly options: VillageScannerOptions;

    constructor(options: Partial<VillageScannerOptions> = {}) {
        this.options = { ...DEFAULTS, ...options };
    }

    scan(observation: VillageObservation): readonly VillageCandidate[] {
        const clusters = this.clusters(observation.villagers);
        const candidates: VillageCandidate[] = [];
        for (const cluster of clusters) {
            if (cluster.length < this.options.minimumVillagers) continue;
            const near = (position: Vec3): boolean =>
                cluster.some(
                    (villager) =>
                        VillageScanner.distance(villager, position) <= this.options.clusterRadius,
                );
            const beds = observation.beds.filter(near);
            const doors = observation.doors.filter(near);
            const workstations = observation.workstations.filter(near);
            const farmland = observation.farmland.filter(near);
            const structures = beds.length + doors.length + workstations.length + farmland.length;
            if (structures < this.options.minimumStructures) continue;
            const points = [...cluster, ...beds, ...doors, ...workstations, ...farmland];
            const min = VillageScanner.min(points);
            const max = VillageScanner.max(points);
            candidates.push({
                id: `village.${min.x}.${min.z}`,
                min,
                max,
                villagers: cluster.length,
                beds: beds.length,
                doors: doors.length,
                workstations: workstations.length,
                farmland: farmland.length,
                confidence: Math.min(1, 0.3 + structures * 0.05 + cluster.length * 0.1),
            });
        }
        return candidates;
    }

    private clusters(villagers: readonly Vec3[]): Vec3[][] {
        const remaining = [...villagers];
        const clusters: Vec3[][] = [];
        while (remaining.length > 0) {
            const seed = remaining.shift();
            if (seed === undefined) break;
            const cluster = [seed];
            let changed = true;
            while (changed) {
                changed = false;
                for (let index = remaining.length - 1; index >= 0; index -= 1) {
                    const candidate = remaining[index];
                    if (candidate === undefined) continue;
                    if (
                        cluster.some(
                            (member) =>
                                VillageScanner.distance(member, candidate) <=
                                this.options.clusterRadius,
                        )
                    ) {
                        cluster.push(candidate);
                        remaining.splice(index, 1);
                        changed = true;
                    }
                }
            }
            clusters.push(cluster);
        }
        return clusters;
    }

    private static min(points: readonly Vec3[]): Vec3 {
        return points.reduce(
            (result, point) => ({
                x: Math.min(result.x, point.x),
                y: Math.min(result.y, point.y),
                z: Math.min(result.z, point.z),
            }),
            {
                x: Number.POSITIVE_INFINITY,
                y: Number.POSITIVE_INFINITY,
                z: Number.POSITIVE_INFINITY,
            },
        );
    }

    private static max(points: readonly Vec3[]): Vec3 {
        return points.reduce(
            (result, point) => ({
                x: Math.max(result.x, point.x),
                y: Math.max(result.y, point.y),
                z: Math.max(result.z, point.z),
            }),
            {
                x: Number.NEGATIVE_INFINITY,
                y: Number.NEGATIVE_INFINITY,
                z: Number.NEGATIVE_INFINITY,
            },
        );
    }

    private static distance(left: Vec3, right: Vec3): number {
        return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
    }
}

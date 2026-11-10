import type { VoxelBlock } from './types.js';

export interface AxisRow {
    y: number;
    perpendicular: number;
    coordinates: number[];
}

export interface PathRun {
    y: number;
    perpendicular: number;
    start: number;
    end: number;
}

export interface PathRunCluster {
    y: number;
    start: number;
    end: number;
    perpendicularStart: number;
    perpendicularEnd: number;
    length: number;
    width: number;
}

interface CoordinateRun {
    start: number;
    end: number;
}

export class PathGeometry {
    static rows(blocks: readonly VoxelBlock[], axis: 'x' | 'z'): ReadonlyMap<string, AxisRow> {
        const rows = new Map<string, AxisRow>();
        blocks.forEach((block) => {
            const perpendicular = axis === 'x' ? block.position.z : block.position.x;
            const coordinate = axis === 'x' ? block.position.x : block.position.z;
            const key = `${block.position.y}:${perpendicular}`;
            const row = rows.get(key) ?? { y: block.position.y, perpendicular, coordinates: [] };
            row.coordinates.push(coordinate);
            rows.set(key, row);
        });
        return rows;
    }

    static runs(row: AxisRow, minimumLength: number): readonly PathRun[] {
        const sorted = [...new Set(row.coordinates)].sort((left, right) => left - right);
        const runs: CoordinateRun[] = [];
        let start: number | null = null;
        let previous: number | null = null;
        for (const coordinate of sorted) {
            if (start === null || previous === null) {
                start = coordinate;
                previous = coordinate;
                continue;
            }
            if (coordinate === previous + 1) {
                previous = coordinate;
                continue;
            }
            runs.push({ start, end: previous });
            start = coordinate;
            previous = coordinate;
        }
        if (start !== null && previous !== null) {
            runs.push({ start, end: previous });
        }
        return runs
            .filter((run) => run.end - run.start + 1 >= minimumLength)
            .map((run) => ({
                y: row.y,
                perpendicular: row.perpendicular,
                start: run.start,
                end: run.end,
            }));
    }

    static clusters(runs: readonly PathRun[]): readonly PathRunCluster[] {
        const runsByExtent = new Map<string, PathRun[]>();
        runs.forEach((run) => {
            const key = `${run.y}:${run.start}:${run.end}`;
            const group = runsByExtent.get(key) ?? [];
            group.push(run);
            runsByExtent.set(key, group);
        });
        return [...runsByExtent.values()].flatMap((group) => PathGeometry.widthClusters(group));
    }

    private static widthClusters(group: readonly PathRun[]): readonly PathRunCluster[] {
        const sorted = [...group].sort((left, right) => left.perpendicular - right.perpendicular);
        const contiguous: PathRun[][] = [];
        let current: PathRun[] = [];
        sorted.forEach((run) => {
            const previous = current.at(-1);
            if (previous !== undefined && run.perpendicular !== previous.perpendicular + 1) {
                contiguous.push(current);
                current = [];
            }
            current.push(run);
        });
        if (current.length > 0) {
            contiguous.push(current);
        }
        return contiguous
            .filter((cluster) => cluster.length <= 3)
            .map((cluster) => PathGeometry.cluster(cluster))
            .filter((cluster): cluster is PathRunCluster => cluster !== null);
    }

    private static cluster(runs: readonly PathRun[]): PathRunCluster | null {
        const first = runs[0];
        const last = runs.at(-1);
        if (first === undefined || last === undefined) {
            return null;
        }
        return {
            y: first.y,
            start: first.start,
            end: first.end,
            perpendicularStart: first.perpendicular,
            perpendicularEnd: last.perpendicular,
            length: first.end - first.start + 1,
            width: runs.length,
        };
    }
}

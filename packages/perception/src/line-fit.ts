import type { VoxelPosition } from './types.js';

export interface FittedLine {
    points: readonly VoxelPosition[];
    direction: { x: number; z: number };
    start: VoxelPosition;
    end: VoxelPosition;
    length: number;
    width: number;
}

interface Point {
    x: number;
    z: number;
    position: VoxelPosition;
}

interface ProjectedPoint extends Point {
    along: number;
    perpendicular: number;
}

interface LineCandidate {
    inliers: readonly Point[];
}

const inlierDistance = 1;
const iterations = 32;
const axisTolerance = 0.999;

export class LineFit {
    static fit(points: readonly VoxelPosition[], minimumLength: number): FittedLine | null {
        if (points.length < minimumLength) return null;
        const candidates = LineFit.candidates(points);
        const best = candidates.reduce<LineCandidate | null>(
            (selected, candidate) =>
                selected === null || candidate.inliers.length > selected.inliers.length
                    ? candidate
                    : selected,
            null,
        );
        if (best === null || best.inliers.length < minimumLength) return null;
        const direction = LineFit.direction(best.inliers);
        if (direction === null) return null;
        if (Math.abs(direction.x) > axisTolerance || Math.abs(direction.z) > axisTolerance) {
            return null;
        }
        const projected = LineFit.project(best.inliers, direction);
        const width = LineFit.width(projected);
        const length = Math.max(width, Math.round(best.inliers.length / width));
        if (width > 3 || length < minimumLength || length < width * 2) return null;
        const start = LineFit.extreme(projected, 'along', true);
        const end = LineFit.extreme(projected, 'along', false);
        if (start === null || end === null) return null;
        return {
            points: best.inliers.map((point) => point.position),
            direction,
            start: start.position,
            end: end.position,
            length,
            width,
        };
    }

    private static candidates(points: readonly VoxelPosition[]): readonly LineCandidate[] {
        const candidates: LineCandidate[] = [];
        for (let iteration = 0; iteration < iterations; iteration += 1) {
            const first = points[(iteration * 7 + 1) % points.length];
            const second = points[(iteration * 13 + 5) % points.length];
            if (first === undefined || second === undefined) continue;
            const origin = { x: first.x, z: first.z, position: first };
            const target = { x: second.x, z: second.z, position: second };
            const direction = LineFit.normalize({
                x: target.x - origin.x,
                z: target.z - origin.z,
            });
            if (direction === null) continue;
            const inliers = points
                .map((point) => ({ x: point.x, z: point.z, position: point }))
                .filter((point) => LineFit.distance(point, origin, direction) <= inlierDistance);
            candidates.push({ inliers });
        }
        return candidates;
    }

    private static direction(points: readonly Point[]): { x: number; z: number } | null {
        if (points.length < 2) return null;
        const meanX = points.reduce((total, point) => total + point.x, 0) / points.length;
        const meanZ = points.reduce((total, point) => total + point.z, 0) / points.length;
        const covariance = points.reduce(
            (total, point) => {
                const deltaX = point.x - meanX;
                const deltaZ = point.z - meanZ;
                return {
                    xx: total.xx + deltaX * deltaX,
                    xz: total.xz + deltaX * deltaZ,
                    zz: total.zz + deltaZ * deltaZ,
                };
            },
            { xx: 0, xz: 0, zz: 0 },
        );
        const angle = 0.5 * Math.atan2(2 * covariance.xz, covariance.xx - covariance.zz);
        return LineFit.canonical({ x: Math.cos(angle), z: Math.sin(angle) });
    }

    private static canonical(direction: { x: number; z: number }): { x: number; z: number } {
        if (direction.x < 0 || (direction.x === 0 && direction.z < 0)) {
            return { x: -direction.x, z: -direction.z };
        }
        return direction;
    }

    private static project(
        points: readonly Point[],
        direction: { x: number; z: number },
    ): readonly ProjectedPoint[] {
        const meanX = points.reduce((total, point) => total + point.x, 0) / points.length;
        const meanZ = points.reduce((total, point) => total + point.z, 0) / points.length;
        return points.map((point) => {
            const deltaX = point.x - meanX;
            const deltaZ = point.z - meanZ;
            return {
                ...point,
                along: deltaX * direction.x + deltaZ * direction.z,
                perpendicular: -deltaX * direction.z + deltaZ * direction.x,
            };
        });
    }

    private static width(points: readonly ProjectedPoint[]): number {
        const minimum = Math.min(...points.map((point) => point.perpendicular));
        const maximum = Math.max(...points.map((point) => point.perpendicular));
        return Math.max(1, Math.ceil(maximum - minimum - 1e-6) + 1);
    }

    private static extreme(
        points: readonly ProjectedPoint[],
        key: 'along' | 'perpendicular',
        minimum: boolean,
    ): ProjectedPoint | null {
        return points.reduce<ProjectedPoint | null>((selected, point) => {
            if (selected === null) return point;
            const isMoreExtreme = minimum ? point[key] < selected[key] : point[key] > selected[key];
            return isMoreExtreme ? point : selected;
        }, null);
    }

    private static distance(
        point: Point,
        origin: Point,
        direction: { x: number; z: number },
    ): number {
        const deltaX = point.x - origin.x;
        const deltaZ = point.z - origin.z;
        return Math.abs(deltaX * direction.z - deltaZ * direction.x);
    }

    private static normalize(direction: { x: number; z: number }): { x: number; z: number } | null {
        const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        if (length === 0) return null;
        return LineFit.canonical({ x: direction.x / length, z: direction.z / length });
    }
}

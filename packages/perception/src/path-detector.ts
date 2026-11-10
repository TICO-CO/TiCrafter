import type { ChunkSnapshot, DetectionCandidate, DetectorPort, VoxelBlock } from './types.js';

interface AxisRow {
    y: number;
    perpendicular: number;
    coordinates: number[];
}

interface CoordinateRun {
    start: number;
    end: number;
}

export class PathDetector implements DetectorPort {
    readonly id = 'path';

    constructor(private readonly minimumLength = 8) {}

    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        const blocksByPosition = new Map<string, VoxelBlock>();
        snapshot.blocks.forEach((block) => {
            blocksByPosition.set(PathDetector.key(block), block);
        });
        const standable = snapshot.blocks.filter((block) =>
            PathDetector.isStandable(block, blocksByPosition),
        );
        return [...this.detectAxis(standable, 'x'), ...this.detectAxis(standable, 'z')];
    }

    private detectAxis(
        blocks: readonly VoxelBlock[],
        axis: 'x' | 'z',
    ): readonly DetectionCandidate[] {
        const rows = PathDetector.rows(blocks, axis);
        const candidates: DetectionCandidate[] = [];
        rows.forEach((row) => {
            PathDetector.runs(row.coordinates).forEach((run) => {
                const length = run.end - run.start + 1;
                if (length < this.minimumLength) return;
                candidates.push(PathDetector.candidate(row, run, axis, length));
            });
        });
        return candidates;
    }

    private static rows(blocks: readonly VoxelBlock[], axis: 'x' | 'z'): Map<string, AxisRow> {
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

    private static runs(coordinates: readonly number[]): readonly CoordinateRun[] {
        const sorted = [...new Set(coordinates)].sort((left, right) => left - right);
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
        return runs;
    }

    private static candidate(
        row: AxisRow,
        run: CoordinateRun,
        axis: 'x' | 'z',
        length: number,
    ): DetectionCandidate {
        const start =
            axis === 'x'
                ? { x: run.start, y: row.y, z: row.perpendicular }
                : { x: row.perpendicular, y: row.y, z: run.start };
        const end =
            axis === 'x'
                ? { x: run.end, y: row.y, z: row.perpendicular }
                : { x: row.perpendicular, y: row.y, z: run.end };
        return {
            detectorId: 'path',
            type: 'path',
            bbox: {
                min: { ...start, y: row.y - 1 },
                max: { ...end, y: row.y + 1 },
            },
            anchors: [
                { name: 'start', position: start },
                { name: 'end', position: end },
            ],
            confidence: Math.min(0.95, 0.5 + length / 64),
            evidence: `standable corridor length ${length} width 1`,
        };
    }

    private static isStandable(
        block: VoxelBlock,
        blocksByPosition: ReadonlyMap<string, VoxelBlock>,
    ): boolean {
        if (!block.solid) return false;
        return (
            !PathDetector.isSolidAt(
                blocksByPosition,
                block.position.x,
                block.position.y + 1,
                block.position.z,
            ) &&
            !PathDetector.isSolidAt(
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

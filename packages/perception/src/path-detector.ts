import { PathGeometry, type PathRunCluster } from './path-geometry.js';
import type { ChunkSnapshot, DetectionCandidate, DetectorPort, VoxelBlock } from './types.js';
import { VoxelGeometry } from './voxel-geometry.js';

export class PathDetector implements DetectorPort {
    readonly id = 'path';

    constructor(private readonly minimumLength = 8) {}

    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        const blocksByPosition = VoxelGeometry.byPosition(snapshot.blocks);
        const standable = snapshot.blocks.filter((block) =>
            VoxelGeometry.isStandable(block, blocksByPosition),
        );
        return [...this.detectAxis(standable, 'x'), ...this.detectAxis(standable, 'z')];
    }

    private detectAxis(
        blocks: readonly VoxelBlock[],
        axis: 'x' | 'z',
    ): readonly DetectionCandidate[] {
        const runs = [...PathGeometry.rows(blocks, axis).values()].flatMap((row) =>
            PathGeometry.runs(row, this.minimumLength),
        );
        return PathGeometry.clusters(runs).map((cluster) => PathDetector.candidate(cluster, axis));
    }

    private static candidate(cluster: PathRunCluster, axis: 'x' | 'z'): DetectionCandidate {
        const start =
            axis === 'x'
                ? { x: cluster.start, y: cluster.y, z: cluster.perpendicularStart }
                : { x: cluster.perpendicularStart, y: cluster.y, z: cluster.start };
        const end =
            axis === 'x'
                ? { x: cluster.end, y: cluster.y, z: cluster.perpendicularEnd }
                : { x: cluster.perpendicularEnd, y: cluster.y, z: cluster.end };
        const min =
            axis === 'x'
                ? { x: cluster.start, y: cluster.y - 1, z: cluster.perpendicularStart }
                : { x: cluster.perpendicularStart, y: cluster.y - 1, z: cluster.start };
        const max =
            axis === 'x'
                ? { x: cluster.end, y: cluster.y + 1, z: cluster.perpendicularEnd }
                : { x: cluster.perpendicularEnd, y: cluster.y + 1, z: cluster.end };
        return {
            detectorId: 'path',
            type: 'path',
            bbox: { min, max },
            anchors: [
                { name: 'start', position: start },
                { name: 'end', position: end },
            ],
            confidence: Math.min(0.95, 0.5 + cluster.length / 64),
            evidence: `standable corridor length ${cluster.length} width ${cluster.width}`,
        };
    }
}

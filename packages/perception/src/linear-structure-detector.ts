import { LinearGeometry, type LinearSlab, type LinearSpan } from './linear-geometry.js';
import type {
    ChunkSnapshot,
    DetectionCandidate,
    DetectorPort,
    VoxelBlock,
    VoxelPosition,
} from './types.js';
import { VoxelGeometry } from './voxel-geometry.js';

interface LinearCandidate {
    type: 'wall' | 'bridge' | 'mineshaft';
    bbox: ReturnType<typeof LinearGeometry.bounds>;
    anchors: readonly { name: string; position: VoxelPosition }[];
    confidence: number;
    evidence: string;
}

export class LinearStructureDetector implements DetectorPort {
    readonly id = 'linear-structure';

    constructor(private readonly minimumLength = 8) {}

    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        const solid = new Set(
            snapshot.blocks
                .filter((block) => block.solid)
                .map((block) => LinearStructureDetector.key(block.position)),
        );
        const spans = LinearGeometry.spans(
            LinearGeometry.slabs(snapshot.blocks, this.minimumLength),
        );
        return spans.flatMap((span) =>
            this.candidates(span, solid, snapshot.blocks).map((candidate) =>
                LinearStructureDetector.candidate(candidate),
            ),
        );
    }

    private candidates(
        span: LinearSpan,
        solid: ReadonlySet<string>,
        blocks: readonly VoxelBlock[],
    ): readonly LinearCandidate[] {
        const mineshaft = LinearStructureDetector.mineshaft(span, solid, blocks);
        if (mineshaft !== null) return [mineshaft];
        return LinearStructureDetector.contiguousRuns(span).flatMap((layers) =>
            LinearStructureDetector.stack(span, layers, solid, blocks),
        );
    }

    private static stack(
        span: LinearSpan,
        layers: readonly LinearSlab[],
        solid: ReadonlySet<string>,
        blocks: readonly VoxelBlock[],
    ): readonly LinearCandidate[] {
        const minimumY = layers[0]?.y;
        const maximumY = layers.at(-1)?.y;
        if (minimumY === undefined || maximumY === undefined) return [];
        const height = maximumY - minimumY + 1;
        const deckRatio = LinearGeometry.deckOverAirRatio(span, solid, minimumY);
        const openAbove = LinearGeometry.openAboveRatio(span, solid, minimumY);
        const isBridge = deckRatio >= 0.7 && openAbove >= 0.5;
        if (!isBridge && (height < 2 || height <= span.width)) return [];
        const bbox = LinearGeometry.bounds(span, minimumY, maximumY);
        const materials = VoxelGeometry.materials(blocks, bbox);
        const type = isBridge ? 'bridge' : 'wall';
        return [
            {
                type,
                bbox,
                anchors: [
                    { name: 'start', position: LinearGeometry.start(span, minimumY) },
                    { name: 'end', position: LinearGeometry.end(span, maximumY) },
                ],
                confidence: LinearStructureDetector.confidence(span.length, height, isBridge),
                evidence: `${type} length ${span.length} width ${span.width} height ${height} axis ${span.axis} deck-over-air ${deckRatio.toFixed(2)} materials ${materials.join(',')}`,
            },
        ];
    }

    private static mineshaft(
        span: LinearSpan,
        solid: ReadonlySet<string>,
        blocks: readonly VoxelBlock[],
    ): LinearCandidate | null {
        const pair = LinearStructureDetector.gapPair(span);
        if (pair === null) return null;
        const [lower, upper] = pair;
        const openGap = LinearGeometry.openGapRatio(span, solid, lower.y, upper.y);
        if (openGap < 0.6) return null;
        const bbox = LinearGeometry.bounds(span, lower.y, upper.y);
        const materials = VoxelGeometry.materials(blocks, bbox);
        return {
            type: 'mineshaft',
            bbox,
            anchors: [
                { name: 'start', position: LinearGeometry.start(span, lower.y) },
                { name: 'end', position: LinearGeometry.end(span, upper.y) },
            ],
            confidence: LinearStructureDetector.confidence(
                span.length,
                upper.y - lower.y + 1,
                false,
            ),
            evidence: `mineshaft length ${span.length} width ${span.width} height ${upper.y - lower.y + 1} axis ${span.axis} open-gap ${openGap.toFixed(2)} materials ${materials.join(',')}`,
        };
    }

    private static gapPair(span: LinearSpan): readonly [LinearSlab, LinearSlab] | null {
        const pair = span.layers
            .map((layer, index) => ({ layer, next: span.layers[index + 1] }))
            .find(({ layer, next }) => next !== undefined && next.y - layer.y >= 2);
        if (pair === undefined || pair.next === undefined) return null;
        return [pair.layer, pair.next];
    }

    private static contiguousRuns(span: LinearSpan): readonly (readonly LinearSlab[])[] {
        const runs: LinearSlab[][] = [];
        span.layers.forEach((layer) => {
            const current = runs.at(-1);
            const previous = current?.at(-1);
            if (current === undefined || previous === undefined || layer.y !== previous.y + 1) {
                runs.push([layer]);
                return;
            }
            current.push(layer);
        });
        return runs;
    }

    private static candidate(candidate: LinearCandidate): DetectionCandidate {
        return {
            detectorId: 'linear-structure',
            ...candidate,
        };
    }

    private static confidence(length: number, height: number, isBridge: boolean): number {
        const bridgeBonus = isBridge ? 0.05 : 0;
        return Math.min(
            0.95,
            0.5 + Math.min(length, 32) / 64 + Math.min(height, 4) * 0.04 + bridgeBonus,
        );
    }

    private static key(position: VoxelPosition): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

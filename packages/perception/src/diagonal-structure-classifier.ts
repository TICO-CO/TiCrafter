import {
    type DiagonalLayer,
    DiagonalLineGeometry,
    type DiagonalSpan,
} from './diagonal-line-geometry.js';
import { pathLikeMaterials } from './surface-materials.js';
import type { DetectionCandidate, VoxelBlock } from './types.js';
import { VoxelGeometry } from './voxel-geometry.js';

export class DiagonalStructureClassifier {
    static classify(
        span: DiagonalSpan,
        solid: ReadonlySet<string>,
        blocks: readonly VoxelBlock[],
    ): readonly DetectionCandidate[] {
        const mineshaft = DiagonalStructureClassifier.mineshaft(span, solid, blocks);
        if (mineshaft !== null) return [mineshaft];
        return DiagonalStructureClassifier.contiguousRuns(span).flatMap((layers) =>
            DiagonalStructureClassifier.stack(span, layers, solid, blocks),
        );
    }

    private static stack(
        span: DiagonalSpan,
        layers: readonly DiagonalLayer[],
        solid: ReadonlySet<string>,
        blocks: readonly VoxelBlock[],
    ): readonly DetectionCandidate[] {
        const minimumY = layers[0]?.y;
        const maximumY = layers.at(-1)?.y;
        if (minimumY === undefined || maximumY === undefined) return [];
        const height = maximumY - minimumY + 1;
        const deckRatio = DiagonalLineGeometry.deckOverAirRatio(span, solid);
        const openAbove = DiagonalLineGeometry.openAboveRatio(span, solid);
        const isBridge =
            !DiagonalStructureClassifier.isPathDeck(span, blocks) &&
            deckRatio >= 0.7 &&
            openAbove >= 0.5;
        if (!isBridge && (height < 2 || height <= span.width)) return [];
        const type = isBridge ? 'bridge' : 'wall';
        return [
            {
                detectorId: 'linear-structure',
                type,
                bbox: span.bounds,
                anchors: [
                    { name: 'start', position: { ...span.start, y: minimumY } },
                    { name: 'end', position: { ...span.end, y: maximumY } },
                ],
                confidence: DiagonalStructureClassifier.confidence(span.length, height, isBridge),
                evidence: `${type} length ${span.length} width ${span.width} height ${height} axis diagonal deck-over-air ${deckRatio.toFixed(2)} materials ${VoxelGeometry.materials(blocks, span.bounds).join(',')}`,
            },
        ];
    }

    private static mineshaft(
        span: DiagonalSpan,
        solid: ReadonlySet<string>,
        blocks: readonly VoxelBlock[],
    ): DetectionCandidate | null {
        const pair = DiagonalStructureClassifier.gapPair(span);
        if (pair === null) return null;
        const [lower, upper] = pair;
        const openGap = DiagonalLineGeometry.openGapRatio(lower, upper, solid);
        if (openGap < 0.6) return null;
        return {
            detectorId: 'linear-structure',
            type: 'mineshaft',
            bbox: span.bounds,
            anchors: [
                { name: 'start', position: { ...span.start, y: lower.y } },
                { name: 'end', position: { ...span.end, y: upper.y } },
            ],
            confidence: DiagonalStructureClassifier.confidence(
                span.length,
                upper.y - lower.y + 1,
                false,
            ),
            evidence: `mineshaft length ${span.length} width ${span.width} height ${upper.y - lower.y + 1} axis diagonal open-gap ${openGap.toFixed(2)} materials ${VoxelGeometry.materials(blocks, span.bounds).join(',')}`,
        };
    }

    private static isPathDeck(span: DiagonalSpan, blocks: readonly VoxelBlock[]): boolean {
        const layer = span.layers[0];
        if (layer === undefined || layer.points.length === 0) return false;
        const ids = new Map(
            blocks.map((block) => [DiagonalStructureClassifier.key(block.position), block]),
        );
        const pathBlocks = layer.points.filter((point) => {
            const block = ids.get(DiagonalStructureClassifier.key({ ...point, y: layer.y }));
            return block !== undefined && pathLikeMaterials.has(block.blockId);
        });
        return pathBlocks.length / layer.points.length > 0.5;
    }

    private static gapPair(span: DiagonalSpan): readonly [DiagonalLayer, DiagonalLayer] | null {
        const pair = span.layers
            .map((layer, index) => ({ layer, next: span.layers[index + 1] }))
            .find(({ layer, next }) => next !== undefined && next.y - layer.y >= 2);
        if (pair === undefined || pair.next === undefined) return null;
        return [pair.layer, pair.next];
    }

    private static contiguousRuns(span: DiagonalSpan): readonly (readonly DiagonalLayer[])[] {
        const runs: DiagonalLayer[][] = [];
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

    private static confidence(length: number, height: number, isBridge: boolean): number {
        const bridgeBonus = isBridge ? 0.05 : 0;
        return Math.min(
            0.95,
            0.5 + Math.min(length, 32) / 64 + Math.min(height, 4) * 0.04 + bridgeBonus,
        );
    }

    private static key(position: { x: number; y: number; z: number }): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

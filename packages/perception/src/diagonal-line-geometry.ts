import { BlockClusterer } from './block-clusterer.js';
import { type FittedLine, LineFit } from './line-fit.js';
import type { DetectionBoundingBox, VoxelBlock, VoxelPosition } from './types.js';

export interface DiagonalLayer extends FittedLine {
    y: number;
}

export interface DiagonalSpan {
    layers: readonly DiagonalLayer[];
    start: VoxelPosition;
    end: VoxelPosition;
    length: number;
    width: number;
    bounds: DetectionBoundingBox;
}

const neighborOffsets: readonly { x: number; z: number }[] = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: -1, z: -1 },
];

export class DiagonalLineGeometry {
    static spans(blocks: readonly VoxelBlock[], minimumLength: number): readonly DiagonalSpan[] {
        const layers = DiagonalLineGeometry.layers(blocks, minimumLength);
        return DiagonalLineGeometry.group(layers);
    }

    static deckOverAirRatio(span: DiagonalSpan, solid: ReadonlySet<string>): number {
        const layer = span.layers[0];
        if (layer === undefined || layer.points.length === 0) return 0;
        const open = layer.points.filter(
            (point) => !solid.has(DiagonalLineGeometry.key({ ...point, y: layer.y - 1 })),
        );
        return open.length / layer.points.length;
    }

    static openAboveRatio(span: DiagonalSpan, solid: ReadonlySet<string>): number {
        const layer = span.layers[0];
        if (layer === undefined || layer.points.length === 0) return 0;
        const open = layer.points.filter(
            (point) => !solid.has(DiagonalLineGeometry.key({ ...point, y: layer.y + 1 })),
        );
        return open.length / layer.points.length;
    }

    static openGapRatio(
        lower: DiagonalLayer,
        upper: DiagonalLayer,
        solid: ReadonlySet<string>,
    ): number {
        if (lower.points.length === 0) return 0;
        const open = lower.points.filter((point) =>
            DiagonalLineGeometry.columnIsOpen(point, lower.y, upper.y, solid),
        );
        return open.length / lower.points.length;
    }

    private static layers(
        blocks: readonly VoxelBlock[],
        minimumLength: number,
    ): readonly DiagonalLayer[] {
        const byY = new Map<number, VoxelBlock[]>();
        blocks
            .filter((block) => block.solid)
            .forEach((block) => {
                const layer = byY.get(block.position.y) ?? [];
                layer.push(block);
                byY.set(block.position.y, layer);
            });
        return [...byY.entries()]
            .sort(([leftY], [rightY]) => leftY - rightY)
            .flatMap(([y, layerBlocks]) =>
                DiagonalLineGeometry.clusters(layerBlocks).flatMap((cluster) => {
                    const fitted = LineFit.fit(
                        cluster.map((block) => block.position),
                        minimumLength,
                    );
                    if (fitted === null) return [];
                    return [{ ...fitted, y }];
                }),
            );
    }

    private static clusters(blocks: readonly VoxelBlock[]): readonly (readonly VoxelBlock[])[] {
        const remaining = new Map(
            blocks.map((block) => [DiagonalLineGeometry.key(block.position), block]),
        );
        const clusters: VoxelBlock[][] = [];
        blocks.forEach((block) => {
            if (!remaining.has(DiagonalLineGeometry.key(block.position))) return;
            clusters.push(DiagonalLineGeometry.collect(remaining, block));
        });
        return clusters;
    }

    private static collect(remaining: Map<string, VoxelBlock>, seed: VoxelBlock): VoxelBlock[] {
        const stack: VoxelBlock[] = [seed];
        const cluster: VoxelBlock[] = [];
        remaining.delete(DiagonalLineGeometry.key(seed.position));
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined) break;
            cluster.push(current);
            neighborOffsets.forEach((offset) => {
                const key = DiagonalLineGeometry.key({
                    x: current.position.x + offset.x,
                    y: current.position.y,
                    z: current.position.z + offset.z,
                });
                const neighbor = remaining.get(key);
                if (neighbor === undefined) return;
                remaining.delete(key);
                stack.push(neighbor);
            });
        }
        return cluster;
    }

    private static group(layers: readonly DiagonalLayer[]): readonly DiagonalSpan[] {
        const groups: DiagonalLayer[][] = [];
        layers.forEach((layer) => {
            const group = groups.find((candidate) =>
                DiagonalLineGeometry.sameLine(candidate.at(-1), layer),
            );
            if (group === undefined) {
                groups.push([layer]);
                return;
            }
            group.push(layer);
        });
        return groups
            .map((group) => DiagonalLineGeometry.span(group))
            .filter((span): span is DiagonalSpan => span !== null);
    }

    private static span(layers: readonly DiagonalLayer[]): DiagonalSpan | null {
        const sorted = [...layers].sort((left, right) => left.y - right.y);
        const first = sorted[0];
        const last = sorted.at(-1);
        if (first === undefined || last === undefined) return null;
        const points = sorted.flatMap((layer) => layer.points);
        const bounds = BlockClusterer.boundsOfPositions(points);
        if (bounds === null) return null;
        return {
            layers: sorted,
            start: first.start,
            end: last.end,
            length: first.length,
            width: first.width,
            bounds,
        };
    }

    private static sameLine(previous: DiagonalLayer | undefined, current: DiagonalLayer): boolean {
        if (previous === undefined) return false;
        if (Math.abs(current.y - previous.y) > 16) return false;
        const alignment =
            previous.direction.x * current.direction.x + previous.direction.z * current.direction.z;
        if (Math.abs(alignment) < 0.98) return false;
        return (
            DiagonalLineGeometry.distance(previous.start, current.start) +
                DiagonalLineGeometry.distance(previous.end, current.end) <=
                3 ||
            DiagonalLineGeometry.distance(previous.start, current.end) +
                DiagonalLineGeometry.distance(previous.end, current.start) <=
                3
        );
    }

    private static columnIsOpen(
        point: VoxelPosition,
        lowerY: number,
        upperY: number,
        solid: ReadonlySet<string>,
    ): boolean {
        for (let y = lowerY + 1; y < upperY; y += 1) {
            if (solid.has(DiagonalLineGeometry.key({ ...point, y }))) return false;
        }
        return true;
    }

    private static distance(left: VoxelPosition, right: VoxelPosition): number {
        return Math.sqrt((left.x - right.x) ** 2 + (left.z - right.z) ** 2);
    }

    private static key(position: VoxelPosition): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

import { PathGeometry } from './path-geometry.js';
import type { DetectionBoundingBox, VoxelBlock, VoxelPosition } from './types.js';

export interface LinearSlab {
    axis: 'x' | 'z';
    y: number;
    start: number;
    end: number;
    perpendicularStart: number;
    perpendicularEnd: number;
    length: number;
    width: number;
}

export interface LinearSpan {
    axis: 'x' | 'z';
    start: number;
    end: number;
    perpendicularStart: number;
    perpendicularEnd: number;
    length: number;
    width: number;
    layers: readonly LinearSlab[];
}

export class LinearGeometry {
    static slabs(blocks: readonly VoxelBlock[], minimumLength: number): readonly LinearSlab[] {
        const solid = blocks.filter((block) => block.solid);
        return [
            ...LinearGeometry.axisSlabs(solid, 'x', minimumLength),
            ...LinearGeometry.axisSlabs(solid, 'z', minimumLength),
        ];
    }

    static spans(slabs: readonly LinearSlab[]): readonly LinearSpan[] {
        const grouped = new Map<string, LinearSlab[]>();
        slabs.forEach((slab) => {
            const key = LinearGeometry.spanKey(slab);
            const layers = grouped.get(key) ?? [];
            layers.push(slab);
            grouped.set(key, layers);
        });
        return [...grouped.values()].map((layers) => LinearGeometry.span(layers));
    }

    static deckOverAirRatio(
        span: LinearSpan,
        solid: ReadonlySet<string>,
        minimumY: number,
    ): number {
        const cells = LinearGeometry.cells(span, minimumY);
        if (cells.length === 0) return 0;
        const open = cells.filter(
            (cell) => !solid.has(LinearGeometry.key({ ...cell, y: minimumY - 1 })),
        );
        return open.length / cells.length;
    }

    static openAboveRatio(span: LinearSpan, solid: ReadonlySet<string>, minimumY: number): number {
        const cells = LinearGeometry.cells(span, minimumY);
        if (cells.length === 0) return 0;
        const open = cells.filter(
            (cell) => !solid.has(LinearGeometry.key({ ...cell, y: minimumY + 1 })),
        );
        return open.length / cells.length;
    }

    static openGapRatio(
        span: LinearSpan,
        solid: ReadonlySet<string>,
        lowerY: number,
        upperY: number,
    ): number {
        const cells = LinearGeometry.cells(span, lowerY);
        if (cells.length === 0) return 0;
        const open = cells.filter((cell) =>
            LinearGeometry.columnIsOpen(cell, solid, lowerY, upperY),
        );
        return open.length / cells.length;
    }

    static bounds(span: LinearSpan, minimumY: number, maximumY: number): DetectionBoundingBox {
        const first = LinearGeometry.cellPosition(
            span,
            span.start,
            span.perpendicularStart,
            minimumY,
        );
        const last = LinearGeometry.cellPosition(span, span.end, span.perpendicularEnd, maximumY);
        return {
            min: {
                x: Math.min(first.x, last.x),
                y: minimumY,
                z: Math.min(first.z, last.z),
            },
            max: {
                x: Math.max(first.x, last.x),
                y: maximumY,
                z: Math.max(first.z, last.z),
            },
        };
    }

    static start(span: LinearSpan, y: number): VoxelPosition {
        return LinearGeometry.cellPosition(span, span.start, span.perpendicularStart, y);
    }

    static end(span: LinearSpan, y: number): VoxelPosition {
        return LinearGeometry.cellPosition(span, span.end, span.perpendicularEnd, y);
    }

    private static axisSlabs(
        blocks: readonly VoxelBlock[],
        axis: 'x' | 'z',
        minimumLength: number,
    ): readonly LinearSlab[] {
        const rows = PathGeometry.rows(blocks, axis);
        const runs = [...rows.values()].flatMap((row) => PathGeometry.runs(row, minimumLength));
        return PathGeometry.clusters(runs).map((cluster) => ({
            axis,
            y: cluster.y,
            start: cluster.start,
            end: cluster.end,
            perpendicularStart: cluster.perpendicularStart,
            perpendicularEnd: cluster.perpendicularEnd,
            length: cluster.length,
            width: cluster.width,
        }));
    }

    private static span(layers: readonly LinearSlab[]): LinearSpan {
        const sorted = [...layers].sort((left, right) => left.y - right.y);
        const first = sorted[0];
        const last = sorted.at(-1);
        if (first === undefined || last === undefined) {
            return {
                axis: 'x',
                start: 0,
                end: 0,
                perpendicularStart: 0,
                perpendicularEnd: 0,
                length: 0,
                width: 0,
                layers: [],
            };
        }
        return {
            axis: first.axis,
            start: first.start,
            end: first.end,
            perpendicularStart: first.perpendicularStart,
            perpendicularEnd: first.perpendicularEnd,
            length: first.length,
            width: first.width,
            layers: sorted,
        };
    }

    private static spanKey(slab: LinearSlab): string {
        return [
            slab.axis,
            slab.start,
            slab.end,
            slab.perpendicularStart,
            slab.perpendicularEnd,
        ].join(':');
    }

    private static cells(span: LinearSpan, y: number): readonly VoxelPosition[] {
        const alongCount = span.end - span.start + 1;
        const perpendicularCount = span.perpendicularEnd - span.perpendicularStart + 1;
        const cells: VoxelPosition[] = [];
        for (let index = 0; index < alongCount * perpendicularCount; index += 1) {
            const along = span.start + (index % alongCount);
            const perpendicular = span.perpendicularStart + Math.floor(index / alongCount);
            cells.push(LinearGeometry.cellPosition(span, along, perpendicular, y));
        }
        return cells;
    }

    private static columnIsOpen(
        cell: VoxelPosition,
        solid: ReadonlySet<string>,
        lowerY: number,
        upperY: number,
    ): boolean {
        for (let y = lowerY + 1; y < upperY; y += 1) {
            if (solid.has(LinearGeometry.key({ ...cell, y }))) return false;
        }
        return true;
    }

    private static cellPosition(
        span: LinearSpan,
        along: number,
        perpendicular: number,
        y: number,
    ): VoxelPosition {
        return span.axis === 'x'
            ? { x: along, y, z: perpendicular }
            : { x: perpendicular, y, z: along };
    }

    private static key(position: VoxelPosition): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

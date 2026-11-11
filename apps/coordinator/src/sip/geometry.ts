import type { SipBlockPosition, SipBoundingBox } from './types.js';

export class SipGeometry {
    static isValidBbox(bbox: SipBoundingBox): boolean {
        return bbox.min.x <= bbox.max.x && bbox.min.y <= bbox.max.y && bbox.min.z <= bbox.max.z;
    }

    static overlaps(first: SipBoundingBox, second: SipBoundingBox): boolean {
        return (
            first.min.x <= second.max.x &&
            first.max.x >= second.min.x &&
            first.min.y <= second.max.y &&
            first.max.y >= second.min.y &&
            first.min.z <= second.max.z &&
            first.max.z >= second.min.z
        );
    }

    static contains(outer: SipBoundingBox, inner: SipBoundingBox): boolean {
        return (
            outer.min.x <= inner.min.x &&
            outer.max.x >= inner.max.x &&
            outer.min.y <= inner.min.y &&
            outer.max.y >= inner.max.y &&
            outer.min.z <= inner.min.z &&
            outer.max.z >= inner.max.z
        );
    }

    static pointInBbox(point: SipBlockPosition, bbox: SipBoundingBox): boolean {
        return (
            point.x >= bbox.min.x &&
            point.x <= bbox.max.x &&
            point.y >= bbox.min.y &&
            point.y <= bbox.max.y &&
            point.z >= bbox.min.z &&
            point.z <= bbox.max.z
        );
    }

    static bboxFromPositions(positions: readonly SipBlockPosition[]): SipBoundingBox | null {
        const first = positions[0];
        if (first === undefined) return null;
        return positions.reduce<SipBoundingBox>(
            (bbox, position) => ({
                min: {
                    x: Math.min(bbox.min.x, position.x),
                    y: Math.min(bbox.min.y, position.y),
                    z: Math.min(bbox.min.z, position.z),
                },
                max: {
                    x: Math.max(bbox.max.x, position.x),
                    y: Math.max(bbox.max.y, position.y),
                    z: Math.max(bbox.max.z, position.z),
                },
            }),
            { min: first, max: first },
        );
    }

    static bboxFromBboxes(boxes: readonly SipBoundingBox[]): SipBoundingBox | null {
        const first = boxes[0];
        if (first === undefined) return null;
        return boxes.reduce<SipBoundingBox>(
            (bbox, box) => ({
                min: {
                    x: Math.min(bbox.min.x, box.min.x),
                    y: Math.min(bbox.min.y, box.min.y),
                    z: Math.min(bbox.min.z, box.min.z),
                },
                max: {
                    x: Math.max(bbox.max.x, box.max.x),
                    y: Math.max(bbox.max.y, box.max.y),
                    z: Math.max(bbox.max.z, box.max.z),
                },
            }),
            first,
        );
    }

    static singleBlock(position: SipBlockPosition): SipBoundingBox {
        return { min: position, max: position };
    }
}

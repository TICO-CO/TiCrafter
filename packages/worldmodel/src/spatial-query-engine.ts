import type { Result } from '@ticrafter/core';

import type { LandmarkStorePort } from './landmark-registry.js';
import type { BlockPosition, BoundingBox, Landmark, LandmarkType, WorldFailure } from './types.js';

export interface NearestLandmark {
    landmark: Landmark;
    distance: number;
}

export class SpatialQueryEngine {
    constructor(private readonly store: Pick<LandmarkStorePort, 'list'>) {}

    nearest(
        position: BlockPosition,
        type: LandmarkType | null = null,
    ): Result<NearestLandmark | null, WorldFailure> {
        const [landmarks, listError] = this.store.list();
        if (listError) {
            return [null, listError];
        }
        if (landmarks === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'landmark list returned null' }];
        }
        const matches = landmarks.filter((landmark) => type === null || landmark.type === type);
        let best: NearestLandmark | null = null;
        for (const landmark of matches) {
            const distance = SpatialQueryEngine.distanceToBox(position, landmark.bbox);
            if (best === null || distance < best.distance) {
                best = { landmark, distance };
            }
        }
        return [best, null];
    }

    intersecting(
        bbox: BoundingBox,
        type: LandmarkType | null = null,
    ): Result<readonly Landmark[], WorldFailure> {
        const [landmarks, listError] = this.store.list();
        if (listError) {
            return [null, listError];
        }
        if (landmarks === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'landmark list returned null' }];
        }
        return [
            landmarks.filter(
                (landmark) =>
                    (type === null || landmark.type === type) &&
                    SpatialQueryEngine.intersects(bbox, landmark.bbox),
            ),
            null,
        ];
    }

    private static intersects(left: BoundingBox, right: BoundingBox): boolean {
        return (
            left.min.x <= right.max.x &&
            left.max.x >= right.min.x &&
            left.min.y <= right.max.y &&
            left.max.y >= right.min.y &&
            left.min.z <= right.max.z &&
            left.max.z >= right.min.z
        );
    }

    private static distanceToBox(position: BlockPosition, bbox: BoundingBox): number {
        const x = SpatialQueryEngine.axisDistance(position.x, bbox.min.x, bbox.max.x);
        const y = SpatialQueryEngine.axisDistance(position.y, bbox.min.y, bbox.max.y);
        const z = SpatialQueryEngine.axisDistance(position.z, bbox.min.z, bbox.max.z);
        return Math.sqrt(x * x + y * y + z * z);
    }

    private static axisDistance(value: number, min: number, max: number): number {
        if (value < min) return min - value;
        if (value > max) return value - max;
        return 0;
    }
}

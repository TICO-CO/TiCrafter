import type { Result } from '@ticrafter/core';

import { WorldFailures } from './failures.js';
import type { LandmarkStorePort } from './landmark-registry.js';
import type {
    BlockPosition,
    BoundingBox,
    ChunkBlockObservation,
    ContainerObservation,
    Landmark,
    LandmarkType,
    WorldFailure,
} from './types.js';

export interface NearestLandmark {
    landmark: Landmark;
    distance: number;
}

export interface OccupancyQueryPort {
    blockAt(position: BlockPosition): Result<ChunkBlockObservation | null, WorldFailure>;
}

export interface ContainerQueryPort {
    at(position: BlockPosition): Result<ContainerObservation | null, WorldFailure>;
}

export interface PathGraphQueryPort {
    route(
        from: BlockPosition,
        to: BlockPosition,
    ): Result<readonly BlockPosition[] | null, WorldFailure>;
}

export interface BaseZoneQueryPort {
    insideBase(position: BlockPosition): Result<boolean, WorldFailure>;
}

export interface ProtectionQueryPort {
    isProtected(position: BlockPosition): Result<boolean, WorldFailure>;
}

export interface OwnershipQueryPort {
    whoOwns(bbox: BoundingBox): Result<readonly string[], WorldFailure>;
}

export interface SpatialQueryPorts {
    occupancy?: OccupancyQueryPort;
    containers?: ContainerQueryPort;
    pathGraph?: PathGraphQueryPort;
    baseZones?: BaseZoneQueryPort;
    protection?: ProtectionQueryPort;
    ownership?: OwnershipQueryPort;
}

export class SpatialQueryEngine {
    constructor(
        private readonly store: Pick<LandmarkStorePort, 'list'>,
        private readonly ports: SpatialQueryPorts = {},
    ) {}

    nearest(
        position: BlockPosition,
        type: LandmarkType | null = null,
    ): Result<NearestLandmark | null, WorldFailure> {
        const [landmarks, listError] = this.store.list();
        if (listError) {
            return [null, listError];
        }
        if (landmarks === null) {
            return [null, WorldFailures.landmarkListUnavailable()];
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
            return [null, WorldFailures.landmarkListUnavailable()];
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

    blockAt(position: BlockPosition): Result<ChunkBlockObservation | null, WorldFailure> {
        if (this.ports.occupancy === undefined) {
            return [null, WorldFailures.queryUnavailable('blockAt')];
        }
        return this.ports.occupancy.blockAt(position);
    }

    containerAt(position: BlockPosition): Result<ContainerObservation | null, WorldFailure> {
        if (this.ports.containers !== undefined) {
            return this.ports.containers.at(position);
        }
        const [landmarks, listError] = this.store.list();
        if (listError) return [null, listError];
        if (landmarks === null) {
            return [null, WorldFailures.landmarkListUnavailable()];
        }
        const landmark = landmarks.find(
            (candidate) =>
                candidate.type === 'container' &&
                SpatialQueryEngine.contains(candidate.bbox, position),
        );
        if (landmark === undefined) return [null, null];
        return [
            {
                id: landmark.id,
                position,
                role: 'storage',
                contents: null,
                observedAt: landmark.lastSeen,
                confidence: landmark.confidence,
            },
            null,
        ];
    }

    insideBase(position: BlockPosition): Result<boolean, WorldFailure> {
        if (this.ports.baseZones === undefined) {
            return [null, WorldFailures.queryUnavailable('insideBase')];
        }
        return this.ports.baseZones.insideBase(position);
    }

    route(
        from: BlockPosition,
        to: BlockPosition,
    ): Result<readonly BlockPosition[] | null, WorldFailure> {
        if (this.ports.pathGraph === undefined) {
            return [null, WorldFailures.queryUnavailable('route')];
        }
        return this.ports.pathGraph.route(from, to);
    }

    isProtected(position: BlockPosition): Result<boolean, WorldFailure> {
        if (this.ports.protection === undefined) {
            return [null, WorldFailures.queryUnavailable('isProtected')];
        }
        return this.ports.protection.isProtected(position);
    }

    whoOwns(bbox: BoundingBox): Result<readonly string[], WorldFailure> {
        if (this.ports.ownership === undefined) {
            return [null, WorldFailures.queryUnavailable('whoOwns')];
        }
        return this.ports.ownership.whoOwns(bbox);
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

    private static contains(bounds: BoundingBox, position: BlockPosition): boolean {
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
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

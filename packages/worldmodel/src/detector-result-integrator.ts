import type { Result } from '@ticrafter/core';

import type { LandmarkRegistry } from './landmark-registry.js';
import type { PlanTagging } from './plan-tagging.js';
import type {
    BoundingBox,
    Landmark,
    LandmarkCandidate,
    MergeResult,
    WorldFailure,
} from './types.js';

export class DetectorResultIntegrator {
    constructor(
        private readonly registry: LandmarkRegistry,
        private readonly planTagging: PlanTagging,
    ) {}

    integrate(candidate: LandmarkCandidate): Result<MergeResult, WorldFailure> {
        const tagged = this.planTagging.tag(candidate);
        const [landmarkId, idError] = this.landmarkId(tagged);
        if (idError) return [null, idError];
        if (landmarkId === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'landmark id missing' }];
        }
        return this.registry.upsert({ ...tagged, id: landmarkId }, tagged.observedAt);
    }

    private landmarkId(candidate: LandmarkCandidate): Result<string, WorldFailure> {
        const [existing, listError] = this.registry.list();
        if (listError) return [null, listError];
        if (existing === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'landmark list returned null' }];
        }
        const match = existing.find((landmark) =>
            DetectorResultIntegrator.matches(landmark, candidate),
        );
        if (match !== undefined) return [match.id, null];
        return [DetectorResultIntegrator.generatedId(candidate), null];
    }

    private static matches(existing: Landmark, candidate: LandmarkCandidate): boolean {
        return (
            existing.type === candidate.type &&
            DetectorResultIntegrator.overlap(existing.bbox, candidate.bbox) >= 0.5
        );
    }

    private static generatedId(candidate: LandmarkCandidate): string {
        const { min, max } = candidate.bbox;
        return ['landmark', candidate.type, min.x, min.y, min.z, max.x, max.y, max.z].join(':');
    }

    private static overlap(left: BoundingBox, right: BoundingBox): number {
        const intersection =
            DetectorResultIntegrator.axisOverlap(left.min.x, left.max.x, right.min.x, right.max.x) *
            DetectorResultIntegrator.axisOverlap(left.min.y, left.max.y, right.min.y, right.max.y) *
            DetectorResultIntegrator.axisOverlap(left.min.z, left.max.z, right.min.z, right.max.z);
        if (intersection <= 0) return 0;
        const union =
            DetectorResultIntegrator.volume(left) +
            DetectorResultIntegrator.volume(right) -
            intersection;
        return union === 0 ? 0 : intersection / union;
    }

    private static axisOverlap(
        leftMinimum: number,
        leftMaximum: number,
        rightMinimum: number,
        rightMaximum: number,
    ): number {
        return Math.max(
            0,
            Math.min(leftMaximum, rightMaximum) - Math.max(leftMinimum, rightMinimum) + 1,
        );
    }

    private static volume(bounds: BoundingBox): number {
        return (
            (bounds.max.x - bounds.min.x + 1) *
            (bounds.max.y - bounds.min.y + 1) *
            (bounds.max.z - bounds.min.z + 1)
        );
    }
}

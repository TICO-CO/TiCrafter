import type { Result } from '@ticrafter/core';

import type { BoundingBox, LandmarkCandidate, PlanTag, WorldFailure } from './types.js';

export class PlanTagging {
    private tags: readonly PlanTag[] = [];
    private revision = -1;

    replace(tags: readonly PlanTag[], revision: number): Result<void, WorldFailure> {
        if (!Number.isInteger(revision) || revision < 0) {
            return [null, { type: 'INVALID_PLAN_TAG_REVISION', value: revision }];
        }
        if (revision < this.revision) return [undefined, null];
        this.tags = [...tags].sort((left, right) => right.revision - left.revision);
        this.revision = revision;
        return [undefined, null];
    }

    tag(candidate: LandmarkCandidate): LandmarkCandidate {
        if (candidate.planId !== null) return candidate;
        const matching = this.tags.find(
            (tag) => PlanTagging.containmentRatio(candidate.bbox, tag.bbox) >= 0.5,
        );
        return matching === undefined ? candidate : { ...candidate, planId: matching.planId };
    }

    active(): readonly PlanTag[] {
        return this.tags;
    }

    private static containmentRatio(left: BoundingBox, right: BoundingBox): number {
        const intersection =
            PlanTagging.axisOverlap(left.min.x, left.max.x, right.min.x, right.max.x) *
            PlanTagging.axisOverlap(left.min.y, left.max.y, right.min.y, right.max.y) *
            PlanTagging.axisOverlap(left.min.z, left.max.z, right.min.z, right.max.z);
        const volume = PlanTagging.volume(left);
        return volume === 0 ? 0 : intersection / volume;
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

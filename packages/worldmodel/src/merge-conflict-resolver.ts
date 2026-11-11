import type { Result } from '@ticrafter/core';

import { ConfidenceDecay } from './confidence-decay.js';
import { WorldFailures } from './failures.js';
import { LandmarkComparison } from './landmark-comparison.js';
import { MergeConflictArms } from './merge-conflict-arms.js';
import type { Landmark, LandmarkCandidate, MergeResult, WorldFailure } from './types.js';

export class MergeConflictResolver {
    private readonly arms: MergeConflictArms;

    constructor(private readonly decay: ConfidenceDecay) {
        this.arms = new MergeConflictArms(decay);
    }

    resolve(
        existing: Landmark | null,
        candidate: LandmarkCandidate,
        observedAt: string,
    ): Result<MergeResult, WorldFailure> {
        const confidenceError = MergeConflictResolver.validateConfidence(candidate.confidence);
        if (confidenceError) {
            return [null, confidenceError];
        }
        const reliabilityError = MergeConflictResolver.validateReliability(
            candidate.evidence.reliability,
        );
        if (reliabilityError) {
            return [null, reliabilityError];
        }
        const incoming = MergeConflictResolver.toLandmark(candidate);
        if (existing === null) {
            return this.arms.create(incoming, observedAt);
        }

        const [decayedExisting, decayError] = this.decay.apply(existing, observedAt);
        if (decayError) {
            return [null, decayError];
        }
        if (decayedExisting === null) {
            return [null, WorldFailures.invalidTimestamp(observedAt)];
        }
        const ordering = LandmarkComparison.compareTimestamps(
            candidate.observedAt,
            existing.lastSeen,
        );
        if (ordering === null) {
            return [null, WorldFailures.invalidTimestamp(candidate.observedAt)];
        }
        if (ordering > 0) {
            return this.arms.replace(decayedExisting.landmark, incoming, observedAt);
        }
        if (ordering < 0) {
            return this.arms.keep(decayedExisting, incoming);
        }
        return this.arms.resolveTie(decayedExisting, incoming, observedAt);
    }

    private static toLandmark(candidate: LandmarkCandidate): Landmark {
        return {
            id: candidate.id,
            type: candidate.type,
            bbox: candidate.bbox,
            anchors: candidate.anchors,
            confidence: candidate.confidence,
            confidenceUpdatedAt: candidate.observedAt,
            lastSeen: candidate.observedAt,
            evidence: [candidate.evidence],
            planId: candidate.planId,
        };
    }

    private static validateConfidence(value: number): WorldFailure | null {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            return WorldFailures.invalidConfidence(value);
        }
        return null;
    }

    private static validateReliability(value: number): WorldFailure | null {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            return WorldFailures.invalidReliability(value);
        }
        return null;
    }
}

import type { Result } from '@ticrafter/core';

import { ConfidenceDecay, type DecayedLandmark } from './confidence-decay.js';
import { LandmarkComparison } from './landmark-comparison.js';
import type { Landmark, LandmarkCandidate, MergeResult, WorldFailure } from './types.js';

export class MergeConflictResolver {
    constructor(private readonly decay: ConfidenceDecay) {}

    resolve(
        existing: Landmark | null,
        candidate: LandmarkCandidate,
        observedAt: string,
    ): Result<MergeResult, WorldFailure> {
        const confidenceError = MergeConflictResolver.validateConfidence(candidate.confidence);
        if (confidenceError) {
            return [null, confidenceError];
        }
        const incoming = MergeConflictResolver.toLandmark(candidate);
        if (existing === null) {
            return this.create(incoming, observedAt);
        }

        const [decayedExisting, decayError] = this.decay.apply(existing, observedAt);
        if (decayError) {
            return [null, decayError];
        }
        if (decayedExisting === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        const ordering = LandmarkComparison.compareTimestamps(
            candidate.observedAt,
            existing.lastSeen,
        );
        if (ordering === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: candidate.observedAt }];
        }
        if (ordering > 0) {
            return this.replace(decayedExisting.landmark, incoming, observedAt);
        }
        if (ordering < 0) {
            return this.keep(decayedExisting, incoming);
        }
        return this.resolveTie(decayedExisting, incoming, observedAt);
    }

    private create(landmark: Landmark, observedAt: string): Result<MergeResult, WorldFailure> {
        const [decayed, decayError] = this.decay.apply(landmark, observedAt);
        if (decayError) {
            return [null, decayError];
        }
        if (decayed === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        return [
            {
                landmark: decayed.landmark,
                outcome: 'created',
                needsVerification: decayed.needsVerification,
            },
            null,
        ];
    }

    private replace(
        existing: Landmark,
        incoming: Landmark,
        observedAt: string,
    ): Result<MergeResult, WorldFailure> {
        const [decayed, decayError] = this.decay.apply(incoming, observedAt);
        if (decayError) {
            return [null, decayError];
        }
        if (decayed === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        return [
            {
                landmark: {
                    ...decayed.landmark,
                    evidence: LandmarkComparison.mergeEvidence(existing, incoming),
                },
                outcome: 'replaced',
                needsVerification: decayed.needsVerification,
            },
            null,
        ];
    }

    private keep(
        decayedExisting: DecayedLandmark,
        incoming: Landmark,
    ): Result<MergeResult, WorldFailure> {
        const existing = decayedExisting.landmark;
        const conflicting = !LandmarkComparison.sameGeometry(existing, incoming);
        return [
            {
                landmark: {
                    ...existing,
                    evidence: LandmarkComparison.mergeEvidence(existing, incoming),
                },
                outcome: conflicting ? 'flagged' : 'kept',
                needsVerification: conflicting || decayedExisting.needsVerification,
            },
            null,
        ];
    }

    private resolveTie(
        decayedExisting: DecayedLandmark,
        incoming: Landmark,
        observedAt: string,
    ): Result<MergeResult, WorldFailure> {
        const existing = decayedExisting.landmark;
        const conflicting = !LandmarkComparison.sameGeometry(existing, incoming);
        if (!conflicting && incoming.confidence <= existing.confidence) {
            return [
                {
                    landmark: {
                        ...existing,
                        evidence: LandmarkComparison.mergeEvidence(existing, incoming),
                    },
                    outcome: 'kept',
                    needsVerification: decayedExisting.needsVerification,
                },
                null,
            ];
        }
        if (!conflicting) {
            return this.replace(existing, incoming, observedAt);
        }

        const winner = incoming.confidence > existing.confidence ? incoming : existing;
        const [decayed, decayError] = this.decay.apply(winner, observedAt);
        if (decayError) {
            return [null, decayError];
        }
        if (decayed === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        return [
            {
                landmark: {
                    ...decayed.landmark,
                    evidence: LandmarkComparison.mergeEvidence(existing, incoming),
                },
                outcome: 'flagged',
                needsVerification: true,
            },
            null,
        ];
    }

    private static toLandmark(candidate: LandmarkCandidate): Landmark {
        return {
            id: candidate.id,
            type: candidate.type,
            bbox: candidate.bbox,
            anchors: candidate.anchors,
            confidence: candidate.confidence,
            lastSeen: candidate.observedAt,
            evidence: [candidate.evidence],
            planId: candidate.planId,
        };
    }

    private static validateConfidence(value: number): WorldFailure | null {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            return { type: 'INVALID_CONFIDENCE', value };
        }
        return null;
    }
}

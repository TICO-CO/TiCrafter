import type { Result } from '@ticrafter/core';

import { ConfidenceDecay, type DecayedLandmark } from './confidence-decay.js';
import { LandmarkComparison } from './landmark-comparison.js';
import type { Landmark, MergeResult, WorldFailure } from './types.js';

export class MergeConflictArms {
    constructor(private readonly decay: ConfidenceDecay) {}

    create(landmark: Landmark, observedAt: string): Result<MergeResult, WorldFailure> {
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

    replace(
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

    keep(decayedExisting: DecayedLandmark, incoming: Landmark): Result<MergeResult, WorldFailure> {
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

    resolveTie(
        decayedExisting: DecayedLandmark,
        incoming: Landmark,
        observedAt: string,
    ): Result<MergeResult, WorldFailure> {
        const existing = decayedExisting.landmark;
        const conflicting = !LandmarkComparison.sameGeometry(existing, incoming);
        const incomingScore = incoming.confidence * LandmarkComparison.latestReliability(incoming);
        const existingScore = existing.confidence * LandmarkComparison.latestReliability(existing);
        if (!conflicting && incomingScore <= existingScore) {
            return this.keep(decayedExisting, incoming);
        }
        if (!conflicting) {
            return this.replace(existing, incoming, observedAt);
        }

        const winner = incomingScore > existingScore ? incoming : existing;
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
}

import type { Result } from '@ticrafter/core';

import type { Landmark, WorldFailure } from './types.js';

export interface ConfidenceDecayOptions {
    halfLifeMilliseconds: number;
    verificationThreshold: number;
}

export interface DecayedLandmark {
    landmark: Landmark;
    needsVerification: boolean;
}

export class ConfidenceDecay {
    constructor(private readonly options: ConfidenceDecayOptions) {}

    apply(landmark: Landmark, observedAt: string): Result<DecayedLandmark, WorldFailure> {
        const optionsError = this.validateOptions();
        if (optionsError) {
            return [null, optionsError];
        }
        const nowMilliseconds = ConfidenceDecay.parseTimestamp(observedAt);
        if (nowMilliseconds === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        const confidenceTimestamp = landmark.confidenceUpdatedAt ?? landmark.lastSeen;
        const confidenceUpdatedAtMilliseconds = ConfidenceDecay.parseTimestamp(confidenceTimestamp);
        if (confidenceUpdatedAtMilliseconds === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: confidenceTimestamp }];
        }

        const elapsedMilliseconds = Math.max(0, nowMilliseconds - confidenceUpdatedAtMilliseconds);
        const confidence = ConfidenceDecay.clamp(
            landmark.confidence * 2 ** (-elapsedMilliseconds / this.options.halfLifeMilliseconds),
        );
        const nextConfidenceTimestamp =
            nowMilliseconds >= confidenceUpdatedAtMilliseconds ? observedAt : confidenceTimestamp;
        const decayed: Landmark = {
            ...landmark,
            confidence,
            confidenceUpdatedAt: nextConfidenceTimestamp,
        };
        return [
            {
                landmark: decayed,
                needsVerification: confidence < this.options.verificationThreshold,
            },
            null,
        ];
    }

    private validateOptions(): WorldFailure | null {
        const { halfLifeMilliseconds, verificationThreshold } = this.options;
        const validHalfLife = Number.isFinite(halfLifeMilliseconds) && halfLifeMilliseconds > 0;
        const validThreshold =
            Number.isFinite(verificationThreshold) &&
            verificationThreshold >= 0 &&
            verificationThreshold <= 1;
        if (validHalfLife && validThreshold) {
            return null;
        }
        return {
            type: 'INVALID_DECAY_OPTIONS',
            halfLifeMilliseconds,
            verificationThreshold,
        };
    }

    private static parseTimestamp(value: string): number | null {
        const milliseconds = Date.parse(value);
        return Number.isFinite(milliseconds) ? milliseconds : null;
    }

    private static clamp(value: number): number {
        if (!Number.isFinite(value)) return 0;
        return Math.min(1, Math.max(0, value));
    }
}

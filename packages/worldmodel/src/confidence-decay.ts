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
        const nowMilliseconds = ConfidenceDecay.parseTimestamp(observedAt);
        if (nowMilliseconds === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];
        }
        const lastSeenMilliseconds = ConfidenceDecay.parseTimestamp(landmark.lastSeen);
        if (lastSeenMilliseconds === null) {
            return [null, { type: 'INVALID_TIMESTAMP', value: landmark.lastSeen }];
        }

        const elapsedMilliseconds = Math.max(0, nowMilliseconds - lastSeenMilliseconds);
        const confidence = ConfidenceDecay.clamp(
            landmark.confidence * 2 ** (-elapsedMilliseconds / this.options.halfLifeMilliseconds),
        );
        const decayed: Landmark = { ...landmark, confidence };
        return [
            {
                landmark: decayed,
                needsVerification: confidence < this.options.verificationThreshold,
            },
            null,
        ];
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

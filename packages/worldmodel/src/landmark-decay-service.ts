import type { Result } from '@ticrafter/core';

import { ConfidenceDecay, type DecayedLandmark } from './confidence-decay.js';
import type { LandmarkStorePort } from './landmark-registry.js';
import type { WorldFailure } from './types.js';

export class LandmarkDecayService {
    constructor(
        private readonly store: LandmarkStorePort,
        private readonly decay: ConfidenceDecay,
    ) {}

    apply(observedAt: string): Result<readonly DecayedLandmark[], WorldFailure> {
        const [landmarks, listError] = this.store.list();
        if (listError) {
            return [null, listError];
        }
        if (landmarks === null) {
            return [null, { type: 'STORAGE_FAILED', message: 'landmark list returned null' }];
        }
        const results: DecayedLandmark[] = [];
        for (const landmark of landmarks) {
            const [decayed, decayError] = this.decay.apply(landmark, observedAt);
            if (decayError) {
                return [null, decayError];
            }
            if (decayed === null) {
                continue;
            }
            const [, writeError] = this.store.save(decayed.landmark);
            if (writeError) {
                return [null, writeError];
            }
            results.push(decayed);
        }
        return [results, null];
    }
}

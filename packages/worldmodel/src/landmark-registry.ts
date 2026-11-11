import type { Result } from '@ticrafter/core';

import { WorldFailures } from './failures.js';
import type { Landmark, LandmarkCandidate, MergeResult, WorldFailure } from './types.js';

export interface LandmarkStorePort {
    get(id: string): Result<Landmark | null, WorldFailure>;
    list(): Result<readonly Landmark[], WorldFailure>;
    save(landmark: Landmark): Result<void, WorldFailure>;
}

export class InMemoryLandmarkStore implements LandmarkStorePort {
    private readonly landmarks = new Map<string, Landmark>();

    get(id: string): Result<Landmark | null, WorldFailure> {
        return [this.landmarks.get(id) ?? null, null];
    }

    list(): Result<readonly Landmark[], WorldFailure> {
        return [[...this.landmarks.values()], null];
    }

    save(landmark: Landmark): Result<void, WorldFailure> {
        this.landmarks.set(landmark.id, landmark);
        return [undefined, null];
    }
}

export class LandmarkRegistry {
    constructor(
        private readonly store: LandmarkStorePort,
        private readonly resolver: {
            resolve(
                existing: Landmark | null,
                candidate: LandmarkCandidate,
                observedAt: string,
            ): Result<MergeResult, WorldFailure>;
        },
    ) {}

    upsert(candidate: LandmarkCandidate, observedAt: string): Result<MergeResult, WorldFailure> {
        const [existing, readError] = this.store.get(candidate.id);
        if (readError) {
            return [null, readError];
        }
        const [result, resolveError] = this.resolver.resolve(existing, candidate, observedAt);
        if (resolveError) {
            return [null, resolveError];
        }
        if (result === null) {
            return [null, WorldFailures.storageFailed('merge returned null')];
        }
        const [, writeError] = this.store.save(result.landmark);
        if (writeError) {
            return [null, writeError];
        }
        return [result, null];
    }

    get(id: string): Result<Landmark | null, WorldFailure> {
        return this.store.get(id);
    }

    list(): Result<readonly Landmark[], WorldFailure> {
        return this.store.list();
    }
}

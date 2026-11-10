import { describe, expect, it } from 'bun:test';

import { ConfidenceDecay } from './confidence-decay.js';
import {
    InMemoryLandmarkStore,
    LandmarkRegistry,
    type LandmarkStorePort,
} from './landmark-registry.js';
import { MergeConflictResolver } from './merge-conflict-resolver.js';
import type { Landmark, LandmarkCandidate, WorldFailure } from './types.js';

const candidate: LandmarkCandidate = {
    id: 'landmark.farm.1',
    type: 'farm',
    bbox: {
        min: { x: 0, y: 64, z: 0 },
        max: { x: 4, y: 64, z: 4 },
    },
    anchors: [{ name: 'water', position: { x: 2, y: 64, z: 2 } }],
    confidence: 0.8,
    observedAt: '2026-11-10T12:00:00.000Z',
    evidence: {
        sourceBotId: 'bot.tibot1',
        observedAt: '2026-11-10T12:00:00.000Z',
        confidence: 0.8,
        details: 'moist farmland',
    },
    planId: null,
};

const decay = new ConfidenceDecay({
    halfLifeMilliseconds: 60_000,
    verificationThreshold: 0.5,
});

const resolver = new MergeConflictResolver(decay);

class FailingStore implements LandmarkStorePort {
    private readonly failure: WorldFailure = {
        type: 'STORAGE_FAILED',
        message: 'database unavailable',
    };

    get(): [Landmark | null, WorldFailure] {
        return [null, this.failure];
    }

    list(): [readonly Landmark[], WorldFailure] {
        return [[], this.failure];
    }

    save(): [void, WorldFailure] {
        return [undefined, this.failure];
    }
}

describe('LandmarkRegistry', () => {
    it('persists a new landmark', () => {
        const registry = new LandmarkRegistry(new InMemoryLandmarkStore(), resolver);
        const [result, error] = registry.upsert(candidate, candidate.observedAt);

        expect(error).toBeNull();
        if (result === null) return;
        expect(result.outcome).toBe('created');

        const [stored, storeError] = registry.get(candidate.id);
        expect(storeError).toBeNull();
        expect(stored?.id).toBe(candidate.id);
    });

    it('updates a landmark with a newer observation', () => {
        const registry = new LandmarkRegistry(new InMemoryLandmarkStore(), resolver);
        registry.upsert(candidate, candidate.observedAt);
        const [result, error] = registry.upsert(
            {
                ...candidate,
                confidence: 0.9,
                observedAt: '2026-11-10T12:00:10.000Z',
                evidence: {
                    ...candidate.evidence,
                    sourceBotId: 'bot.tibot2',
                    observedAt: '2026-11-10T12:00:10.000Z',
                },
            },
            '2026-11-10T12:00:10.000Z',
        );

        expect(error).toBeNull();
        if (result === null) return;
        expect(result.outcome).toBe('replaced');
        expect(result.landmark.evidence).toHaveLength(2);

        const [landmarks, listError] = registry.list();
        expect(listError).toBeNull();
        expect(landmarks).toHaveLength(1);
    });

    it('propagates storage failures', () => {
        const registry = new LandmarkRegistry(new FailingStore(), resolver);
        const [result, error] = registry.upsert(candidate, candidate.observedAt);

        expect(result).toBeNull();
        expect(error?.type).toBe('STORAGE_FAILED');
    });
});

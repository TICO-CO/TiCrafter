import { describe, expect, it } from 'bun:test';

import { ConfidenceDecay } from './confidence-decay.js';
import { LandmarkDecayService } from './landmark-decay-service.js';
import { InMemoryLandmarkStore } from './landmark-registry.js';
import type { Landmark } from './types.js';

const landmark: Landmark = {
    id: 'landmark.path.1',
    type: 'path',
    bbox: {
        min: { x: 0, y: 64, z: 0 },
        max: { x: 8, y: 64, z: 1 },
    },
    anchors: [],
    confidence: 0.8,
    lastSeen: '2026-11-10T12:00:00.000Z',
    evidence: [],
    planId: null,
};

describe('LandmarkDecayService', () => {
    it('persists decayed confidence and flags verification', () => {
        const store = new InMemoryLandmarkStore();
        store.save(landmark);
        const service = new LandmarkDecayService(
            store,
            new ConfidenceDecay({
                halfLifeMilliseconds: 60_000,
                verificationThreshold: 0.5,
            }),
        );
        const [decayed, error] = service.apply('2026-11-10T12:01:00.000Z');

        expect(error).toBeNull();
        expect(decayed).toHaveLength(1);
        expect(decayed?.[0]?.landmark.confidence.toFixed(3)).toBe('0.400');
        expect(decayed?.[0]?.needsVerification).toBe(true);

        const [stored, storeError] = store.get(landmark.id);
        expect(storeError).toBeNull();
        expect(stored?.confidence.toFixed(3)).toBe('0.400');
    });

    it('rejects an invalid decay timestamp', () => {
        const store = new InMemoryLandmarkStore();
        store.save(landmark);
        const service = new LandmarkDecayService(
            store,
            new ConfidenceDecay({
                halfLifeMilliseconds: 60_000,
                verificationThreshold: 0.5,
            }),
        );
        const [decayed, error] = service.apply('not-a-timestamp');

        expect(decayed).toBeNull();
        expect(error?.type).toBe('INVALID_TIMESTAMP');
    });
});

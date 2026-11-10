import { describe, expect, it } from 'bun:test';

import { ConfidenceDecay } from './confidence-decay.js';
import type { Landmark } from './types.js';

const landmark: Landmark = {
    id: 'landmark.path.1',
    type: 'path',
    bbox: {
        min: { x: 0, y: 64, z: 0 },
        max: { x: 8, y: 64, z: 1 },
    },
    anchors: [{ name: 'start', position: { x: 0, y: 64, z: 0 } }],
    confidence: 0.8,
    lastSeen: '2026-11-10T12:00:00.000Z',
    evidence: [
        {
            sourceBotId: 'bot.tibot1',
            observedAt: '2026-11-10T12:00:00.000Z',
            confidence: 0.8,
            details: 'standable corridor',
        },
    ],
    planId: null,
};

describe('ConfidenceDecay', () => {
    it('halves confidence after one half-life', () => {
        const decay = new ConfidenceDecay({
            halfLifeMilliseconds: 60_000,
            verificationThreshold: 0.5,
        });
        const [decayed, error] = decay.apply(landmark, '2026-11-10T12:01:00.000Z');

        expect(error).toBeNull();
        if (decayed === null) return;
        expect(decayed.landmark.confidence.toFixed(3)).toBe('0.400');
        expect(decayed.needsVerification).toBe(true);
    });

    it('keeps confidence above the verification threshold', () => {
        const decay = new ConfidenceDecay({
            halfLifeMilliseconds: 60_000,
            verificationThreshold: 0.5,
        });
        const [decayed, error] = decay.apply(landmark, '2026-11-10T12:00:30.000Z');

        expect(error).toBeNull();
        if (decayed === null) return;
        expect(decayed.landmark.confidence.toFixed(3)).toBe('0.566');
        expect(decayed.needsVerification).toBe(false);
    });

    it('rejects an invalid observation timestamp', () => {
        const decay = new ConfidenceDecay({
            halfLifeMilliseconds: 60_000,
            verificationThreshold: 0.5,
        });
        const [decayed, error] = decay.apply(landmark, 'not-a-timestamp');

        expect(decayed).toBeNull();
        expect(error).toEqual({ type: 'INVALID_TIMESTAMP', value: 'not-a-timestamp' });
    });
});

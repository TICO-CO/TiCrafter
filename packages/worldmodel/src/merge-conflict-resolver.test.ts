import { describe, expect, it } from 'bun:test';

import { ConfidenceDecay } from './confidence-decay.js';
import { MergeConflictResolver } from './merge-conflict-resolver.js';
import type { Landmark, LandmarkCandidate } from './types.js';

const existingLandmark: Landmark = {
    id: 'landmark.house.1',
    type: 'house',
    bbox: {
        min: { x: 10, y: 64, z: 10 },
        max: { x: 16, y: 70, z: 16 },
    },
    anchors: [{ name: 'door', position: { x: 13, y: 64, z: 10 } }],
    confidence: 0.8,
    lastSeen: '2026-11-10T12:00:00.000Z',
    evidence: [
        {
            sourceBotId: 'bot.tibot1',
            observedAt: '2026-11-10T12:00:00.000Z',
            confidence: 0.8,
            details: 'enclosed interior',
        },
    ],
    planId: null,
};

const candidate: LandmarkCandidate = {
    id: 'landmark.house.1',
    type: 'house',
    bbox: {
        min: { x: 10, y: 64, z: 10 },
        max: { x: 16, y: 70, z: 16 },
    },
    anchors: [{ name: 'door', position: { x: 13, y: 64, z: 10 } }],
    confidence: 0.9,
    observedAt: '2026-11-10T12:00:10.000Z',
    evidence: {
        sourceBotId: 'bot.tibot2',
        observedAt: '2026-11-10T12:00:10.000Z',
        confidence: 0.9,
        details: 'enclosed interior',
    },
    planId: null,
};

const resolver = new MergeConflictResolver(
    new ConfidenceDecay({
        halfLifeMilliseconds: 60_000,
        verificationThreshold: 0.5,
    }),
);

describe('MergeConflictResolver', () => {
    it('creates a landmark from the first candidate', () => {
        const [result, error] = resolver.resolve(null, candidate, '2026-11-10T12:00:10.000Z');

        expect(error).toBeNull();
        if (result === null) return;
        expect(result.outcome).toBe('created');
        expect(result.landmark.id).toBe(candidate.id);
        expect(result.landmark.evidence).toHaveLength(1);
    });

    it('replaces an older landmark with a newer observation', () => {
        const [result, error] = resolver.resolve(
            existingLandmark,
            candidate,
            '2026-11-10T12:00:10.000Z',
        );

        expect(error).toBeNull();
        if (result === null) return;
        expect(result.outcome).toBe('replaced');
        expect(result.landmark.lastSeen).toBe(candidate.observedAt);
        expect(result.landmark.evidence).toHaveLength(2);
    });

    it('keeps the newest observation and flags conflicting geometry', () => {
        const staleCandidate: LandmarkCandidate = {
            ...candidate,
            observedAt: '2026-11-10T11:59:50.000Z',
            bbox: {
                min: { x: 30, y: 64, z: 30 },
                max: { x: 36, y: 70, z: 36 },
            },
            evidence: {
                ...candidate.evidence,
                observedAt: '2026-11-10T11:59:50.000Z',
            },
        };
        const [result, error] = resolver.resolve(
            existingLandmark,
            staleCandidate,
            '2026-11-10T12:00:10.000Z',
        );

        expect(error).toBeNull();
        if (result === null) return;
        expect(result.outcome).toBe('flagged');
        expect(result.landmark.lastSeen).toBe(existingLandmark.lastSeen);
        expect(result.needsVerification).toBe(true);
    });

    it('flags a same-time conflict and keeps the higher confidence', () => {
        const conflictingCandidate: LandmarkCandidate = {
            ...candidate,
            observedAt: existingLandmark.lastSeen,
            bbox: {
                min: { x: 30, y: 64, z: 30 },
                max: { x: 36, y: 70, z: 36 },
            },
            evidence: {
                ...candidate.evidence,
                observedAt: existingLandmark.lastSeen,
            },
        };
        const [result, error] = resolver.resolve(
            existingLandmark,
            conflictingCandidate,
            existingLandmark.lastSeen,
        );

        expect(error).toBeNull();
        if (result === null) return;
        expect(result.outcome).toBe('flagged');
        expect(result.landmark.confidence).toBe(0.9);
        expect(result.needsVerification).toBe(true);
    });

    it('rejects a candidate with an invalid confidence', () => {
        const [result, error] = resolver.resolve(
            existingLandmark,
            { ...candidate, confidence: 1.5 },
            candidate.observedAt,
        );

        expect(result).toBeNull();
        expect(error).toEqual({ type: 'INVALID_CONFIDENCE', value: 1.5 });
    });
});

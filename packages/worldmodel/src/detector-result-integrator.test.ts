import { describe, expect, it } from 'bun:test';

import { ConfidenceDecay } from './confidence-decay.js';
import { DetectorResultIntegrator } from './detector-result-integrator.js';
import { InMemoryLandmarkStore, LandmarkRegistry } from './landmark-registry.js';
import { MergeConflictResolver } from './merge-conflict-resolver.js';
import { PlanTagging } from './plan-tagging.js';
import type { LandmarkCandidate } from './types.js';

const candidate: LandmarkCandidate = {
    id: '',
    type: 'house',
    bbox: {
        min: { x: 0, y: 64, z: 0 },
        max: { x: 4, y: 68, z: 4 },
    },
    anchors: [{ name: 'door', position: { x: 2, y: 64, z: 0 } }],
    confidence: 0.8,
    observedAt: '2026-11-10T12:00:00.000Z',
    evidence: {
        sourceBotId: 'bot.tibot1',
        observedAt: '2026-11-10T12:00:00.000Z',
        confidence: 0.8,
        reliability: 0.9,
        details: 'enclosed interior',
    },
    planId: null,
};

function createIntegrator(): DetectorResultIntegrator {
    const registry = new LandmarkRegistry(
        new InMemoryLandmarkStore(),
        new MergeConflictResolver(
            new ConfidenceDecay({
                halfLifeMilliseconds: 60_000,
                verificationThreshold: 0.3,
            }),
        ),
    );
    return new DetectorResultIntegrator(registry, new PlanTagging());
}

describe('DetectorResultIntegrator', () => {
    it('creates a landmark with a deterministic id', () => {
        const [result, error] = createIntegrator().integrate(candidate);

        expect(error).toBeNull();
        expect(result?.landmark.id).toBe('landmark:house:0:64:0:4:68:4');
    });

    it('merges overlapping candidates into one landmark', () => {
        const integrator = createIntegrator();
        integrator.integrate(candidate);
        const [result, error] = integrator.integrate({
            ...candidate,
            bbox: {
                min: { x: 1, y: 64, z: 0 },
                max: { x: 5, y: 68, z: 4 },
            },
            observedAt: '2026-11-10T12:00:10.000Z',
        });

        expect(error).toBeNull();
        expect(result?.landmark.id).toBe('landmark:house:0:64:0:4:68:4');
    });

    it('applies active plan tags', () => {
        const registry = new LandmarkRegistry(
            new InMemoryLandmarkStore(),
            new MergeConflictResolver(
                new ConfidenceDecay({
                    halfLifeMilliseconds: 60_000,
                    verificationThreshold: 0.3,
                }),
            ),
        );
        const tagging = new PlanTagging();
        tagging.replace(
            [
                {
                    planId: 'structure.house.1',
                    bbox: candidate.bbox,
                    revision: 1,
                },
            ],
            1,
        );
        const integrator = new DetectorResultIntegrator(registry, tagging);

        const [result, error] = integrator.integrate(candidate);

        expect(error).toBeNull();
        expect(result?.landmark.planId).toBe('structure.house.1');
    });
});

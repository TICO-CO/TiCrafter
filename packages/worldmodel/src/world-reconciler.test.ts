import { describe, expect, it } from 'bun:test';

import { InMemoryLandmarkStore } from './landmark-registry.js';
import { SpatialQueryEngine } from './spatial-query-engine.js';
import type { BoundingBox, IntendedStructure, Landmark } from './types.js';
import { WorldReconciler } from './world-reconciler.js';

const bbox: BoundingBox = {
    min: { x: 0, y: 64, z: 0 },
    max: { x: 4, y: 68, z: 4 },
};

const landmark: Landmark = {
    id: 'landmark.house.1',
    type: 'house',
    bbox,
    anchors: [],
    confidence: 0.8,
    confidenceUpdatedAt: '2026-11-10T12:00:00.000Z',
    lastSeen: '2026-11-10T12:00:00.000Z',
    evidence: [],
    planId: 'structure.house.1',
};

const intended: IntendedStructure = {
    id: 'structure.house.1',
    bbox,
    status: 'complete',
    planId: 'structure.house.1',
};

describe('WorldReconciler', () => {
    it('reports missing intended structures', () => {
        const reconciler = new WorldReconciler(new SpatialQueryEngine(new InMemoryLandmarkStore()));

        const [findings, error] = reconciler.reconcile([intended]);

        expect(error).toBeNull();
        expect(findings).toEqual([
            {
                structureId: intended.id,
                kind: 'missing',
                bbox,
                observedLandmarkIds: [],
            },
        ]);
    });

    it('accepts observed structures with the intended plan tag', () => {
        const store = new InMemoryLandmarkStore();
        store.save(landmark);
        const reconciler = new WorldReconciler(new SpatialQueryEngine(store));

        const [findings, error] = reconciler.reconcile([intended]);

        expect(error).toBeNull();
        expect(findings).toEqual([]);
    });

    it('reports plan tag mismatches', () => {
        const store = new InMemoryLandmarkStore();
        store.save({ ...landmark, planId: 'structure.house.other' });
        const reconciler = new WorldReconciler(new SpatialQueryEngine(store));

        const [findings, error] = reconciler.reconcile([intended]);

        expect(error).toBeNull();
        expect(findings?.[0]?.kind).toBe('status-mismatch');
    });
});

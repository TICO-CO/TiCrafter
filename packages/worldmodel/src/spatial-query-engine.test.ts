import { describe, expect, it } from 'bun:test';

import { InMemoryLandmarkStore } from './landmark-registry.js';
import { SpatialQueryEngine } from './spatial-query-engine.js';
import type { ContainerObservation, Landmark } from './types.js';

const house: Landmark = {
    id: 'landmark.house.1',
    type: 'house',
    bbox: {
        min: { x: 10, y: 64, z: 10 },
        max: { x: 16, y: 70, z: 16 },
    },
    anchors: [],
    confidence: 0.8,
    confidenceUpdatedAt: '2026-11-10T12:00:00.000Z',
    lastSeen: '2026-11-10T12:00:00.000Z',
    evidence: [],
    planId: null,
};

const farm: Landmark = {
    ...house,
    id: 'landmark.farm.1',
    type: 'farm',
    bbox: {
        min: { x: 30, y: 64, z: 30 },
        max: { x: 36, y: 64, z: 36 },
    },
};

function storeWithLandmarks(): InMemoryLandmarkStore {
    const store = new InMemoryLandmarkStore();
    store.save(house);
    store.save(farm);
    return store;
}

describe('SpatialQueryEngine', () => {
    it('finds the nearest landmark', () => {
        const engine = new SpatialQueryEngine(storeWithLandmarks());
        const [nearest, error] = engine.nearest({ x: 0, y: 64, z: 0 });

        expect(error).toBeNull();
        expect(nearest?.landmark.id).toBe(house.id);
        expect(nearest?.distance.toFixed(3)).toBe('14.142');
    });

    it('filters by landmark type', () => {
        const engine = new SpatialQueryEngine(storeWithLandmarks());
        const [nearest, error] = engine.nearest({ x: 0, y: 64, z: 0 }, 'farm');

        expect(error).toBeNull();
        expect(nearest?.landmark.id).toBe(farm.id);
    });

    it('returns zero distance inside a landmark', () => {
        const engine = new SpatialQueryEngine(storeWithLandmarks());
        const [nearest, error] = engine.nearest({ x: 12, y: 66, z: 12 });

        expect(error).toBeNull();
        expect(nearest?.distance).toBe(0);
    });

    it('returns landmarks intersecting a bounding box', () => {
        const engine = new SpatialQueryEngine(storeWithLandmarks());
        const [landmarks, error] = engine.intersecting({
            min: { x: 12, y: 64, z: 12 },
            max: { x: 14, y: 68, z: 14 },
        });

        expect(error).toBeNull();
        expect(landmarks).toHaveLength(1);
        expect(landmarks?.[0]?.id).toBe(house.id);
    });

    it('delegates world queries to injected ports', () => {
        const container: ContainerObservation = {
            id: 'container.chest.1',
            position: { x: 2, y: 64, z: 2 },
            role: 'storage',
            contents: null,
            observedAt: '2026-11-10T12:00:00.000Z',
            confidence: 0.8,
        };
        const engine = new SpatialQueryEngine(storeWithLandmarks(), {
            occupancy: {
                blockAt: () => [
                    { position: { x: 1, y: 64, z: 1 }, blockId: 'stone', solid: true },
                    null,
                ],
            },
            containers: { at: () => [container, null] },
            pathGraph: { route: () => [[{ x: 0, y: 64, z: 0 }], null] },
            baseZones: { insideBase: () => [true, null] },
            protection: { isProtected: () => [true, null] },
            ownership: { whoOwns: () => [['bot.tibot1'], null] },
        });

        expect(engine.blockAt({ x: 1, y: 64, z: 1 })[0]?.blockId).toBe('stone');
        expect(engine.containerAt(container.position)[0]?.id).toBe(container.id);
        expect(engine.route({ x: 0, y: 64, z: 0 }, { x: 1, y: 64, z: 1 })[0]).toHaveLength(1);
        expect(engine.insideBase({ x: 0, y: 64, z: 0 })[0]).toBe(true);
        expect(engine.isProtected({ x: 0, y: 64, z: 0 })[0]).toBe(true);
        expect(engine.whoOwns(house.bbox)[0]).toEqual(['bot.tibot1']);
    });

    it('returns typed failures when SIP-backed queries are unavailable', () => {
        const engine = new SpatialQueryEngine(storeWithLandmarks());

        expect(engine.blockAt({ x: 0, y: 64, z: 0 })[1]?.type).toBe('QUERY_UNAVAILABLE');
        expect(engine.route({ x: 0, y: 64, z: 0 }, { x: 1, y: 64, z: 1 })[1]?.type).toBe(
            'QUERY_UNAVAILABLE',
        );
        expect(engine.insideBase({ x: 0, y: 64, z: 0 })[1]?.type).toBe('QUERY_UNAVAILABLE');
        expect(engine.isProtected({ x: 0, y: 64, z: 0 })[1]?.type).toBe('QUERY_UNAVAILABLE');
        expect(engine.whoOwns(house.bbox)[1]?.type).toBe('QUERY_UNAVAILABLE');
    });
});

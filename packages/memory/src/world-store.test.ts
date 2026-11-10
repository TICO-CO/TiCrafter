import { afterEach, describe, expect, it } from 'bun:test';

import { TestDatabase } from './test-database.js';
import { WorldStore } from './world-store.js';

afterEach(() => {
    TestDatabase.cleanup();
});

describe('WorldStore', () => {
    it('round-trips chunk versions', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new WorldStore(database);

        const [, saveError] = store.saveChunk({
            x: 1,
            z: 2,
            version: 4,
            payloadJson: '{"blocks":[]}',
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(saveError).toBeNull();

        const [chunk, readError] = store.getChunk(1, 2);
        expect(readError).toBeNull();
        expect(chunk?.version).toBe(4);
        expect(chunk?.payloadJson).toBe('{"blocks":[]}');
        database.close();
    });

    it('round-trips landmarks with evidence', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new WorldStore(database);

        const [, saveError] = store.saveLandmark({
            id: 'landmark.house.1',
            type: 'house',
            x: 10,
            y: 64,
            z: 10,
            confidence: 0.8,
            bboxJson: '{"min":{"x":10,"y":64,"z":10},"max":{"x":16,"y":70,"z":16}}',
            anchorsJson: '[]',
            evidenceJson: '[{"sourceBotId":"bot.tibot1"}]',
            lastSeen: '2026-11-10T12:00:00.000Z',
            planId: null,
            updatedAt: '2026-11-10T12:00:00.000Z',
        });
        expect(saveError).toBeNull();

        const [landmark, readError] = store.getLandmark('landmark.house.1');
        expect(readError).toBeNull();
        expect(landmark?.type).toBe('house');
        expect(landmark?.confidence).toBe(0.8);
        expect(landmark?.evidenceJson).toBe('[{"sourceBotId":"bot.tibot1"}]');

        const [landmarks, listError] = store.listLandmarks();
        expect(listError).toBeNull();
        expect(landmarks).toHaveLength(1);
        database.close();
    });

    it('updates an existing landmark', () => {
        const [database, openError] = TestDatabase.openTemporary();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new WorldStore(database);
        const record = {
            id: 'landmark.farm.1',
            type: 'farm',
            x: 0,
            y: 64,
            z: 0,
            confidence: 0.5,
            bboxJson: '{}',
            anchorsJson: '[]',
            evidenceJson: '[]',
            lastSeen: '2026-11-10T12:00:00.000Z',
            planId: null,
            updatedAt: '2026-11-10T12:00:00.000Z',
        };

        store.saveLandmark(record);
        store.saveLandmark({ ...record, confidence: 0.9, updatedAt: '2026-11-10T12:01:00.000Z' });

        const [landmark, readError] = store.getLandmark(record.id);
        expect(readError).toBeNull();
        expect(landmark?.confidence).toBe(0.9);
        expect(landmark?.updatedAt).toBe('2026-11-10T12:01:00.000Z');
        database.close();
    });
});

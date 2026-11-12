import type { Blueprint } from '@ticrafter/building';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { BlueprintDocumentService } from './blueprint-document-service.js';
import { BlueprintDocumentRepository } from './blueprint-repository.js';

const blueprint: Blueprint = {
    id: 'blueprint.home',
    anchor: { x: 10, y: 64, z: -5 },
    rotation: 0,
    blocks: [
        { x: 10, y: 64, z: -5, state: { name: 'stone' }, priority: 0 },
        { x: 11, y: 64, z: -5, state: { name: 'oak_planks' }, priority: 1 },
    ],
    materials: [
        { item: 'stone', count: 1 },
        { item: 'oak_planks', count: 1 },
    ],
    constraints: [],
};

const openService = (): [CoordinatorDatabase, BlueprintDocumentService] | null => {
    const [database, openError] = CoordinatorTestSupport.openDatabase();
    if (openError) return null;
    if (database === null) return null;
    return [
        database,
        new BlueprintDocumentService({
            documents: new BlueprintDocumentRepository(database),
            now: () => '2026-11-12T12:00:00.000Z',
        }),
    ];
};

afterEach(() => {
    CoordinatorTestSupport.cleanup();
});

describe('BlueprintDocumentService', () => {
    it('stores revisions and returns the latest document', () => {
        const opened = openService();
        if (opened === null) return;
        const [, service] = opened;
        const [first, firstError] = service.commit({
            id: 'home.tibot1',
            source: 'composed',
            provenance: { createdBy: 'bot.tibot1', briefId: 'brief.home' },
            blueprint,
        });

        expect(firstError).toBeNull();
        expect(first?.revision).toBe(1);
        expect(first?.hash).toHaveLength(64);

        const changed: Blueprint = {
            ...blueprint,
            blocks: [
                ...blueprint.blocks,
                { x: 10, y: 65, z: -5, state: { name: 'glass' }, priority: 2 },
            ],
            materials: [...blueprint.materials, { item: 'glass', count: 1 }],
        };
        const [second, secondError] = service.commit({
            id: 'home.tibot1',
            source: 'composed',
            provenance: { createdBy: 'bot.tibot1', briefId: 'brief.home' },
            blueprint: changed,
        });

        expect(secondError).toBeNull();
        expect(second?.revision).toBe(2);
        expect(second?.hash).not.toBe(first?.hash);

        const [latest, latestError] = service.latest('home.tibot1');
        expect(latestError).toBeNull();
        expect(latest?.revision).toBe(2);

        const [stored, getError] = service.get('home.tibot1', 1);
        expect(getError).toBeNull();
        expect(stored?.blueprint.id).toBe('blueprint.home');

        const [all, listError] = service.list('home.tibot1');
        expect(listError).toBeNull();
        expect(all).toHaveLength(2);
    });

    it('rejects invalid blueprints and empty ids', () => {
        const opened = openService();
        if (opened === null) return;
        const [, service] = opened;

        const [invalid, invalidError] = service.commit({
            id: 'home.tibot1',
            source: 'composed',
            provenance: { createdBy: 'bot.tibot1' },
            blueprint: { ...blueprint, blocks: [] },
        });
        expect(invalid).toBeNull();
        expect(invalidError?.type).toBe('INVALID_BLUEPRINT');

        const [empty, emptyError] = service.commit({
            id: ' ',
            source: 'composed',
            provenance: { createdBy: 'bot.tibot1' },
            blueprint,
        });
        expect(empty).toBeNull();
        expect(emptyError?.type).toBe('INVALID_ID');
    });

    it('returns null for unknown documents', () => {
        const opened = openService();
        if (opened === null) return;
        const [, service] = opened;

        expect(service.latest('missing')[0]).toBeNull();
        expect(service.get('missing', 1)[0]).toBeNull();
    });
});

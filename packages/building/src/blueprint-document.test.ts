import { describe, expect, it } from 'bun:test';

import { type BlueprintDocumentContent, BlueprintDocumentHash } from './blueprint-document.js';
import type { Blueprint } from './blueprint-ir.js';

const blueprint: Blueprint = {
    id: 'blueprint.house.1847',
    anchor: { x: 120, y: 64, z: -40 },
    rotation: 90,
    blocks: [
        {
            x: 120,
            y: 64,
            z: -40,
            state: { name: 'cobblestone', properties: { axis: 'x' } },
            priority: 0,
        },
    ],
    materials: [{ item: 'cobblestone', count: 1 }],
    constraints: [],
};

const document: BlueprintDocumentContent = {
    id: 'document.house.1847',
    revision: 1,
    source: 'composed',
    provenance: {
        createdBy: 'bot.tibot1',
        createdAt: '2026-11-12T12:00:00.000Z',
        briefId: 'brief.house.1847',
    },
    blueprint,
};

describe('BlueprintDocumentHash', () => {
    it('hashes the same document deterministically', () => {
        expect(BlueprintDocumentHash.of(document)).toBe(BlueprintDocumentHash.of(document));
    });

    it('ignores object key order', () => {
        const reordered: BlueprintDocumentContent = {
            blueprint: {
                ...blueprint,
                blocks: [
                    {
                        priority: 0,
                        state: { properties: { axis: 'x' }, name: 'cobblestone' },
                        z: -40,
                        y: 64,
                        x: 120,
                    },
                ],
            },
            provenance: {
                briefId: 'brief.house.1847',
                createdAt: '2026-11-12T12:00:00.000Z',
                createdBy: 'bot.tibot1',
            },
            source: 'composed',
            revision: 1,
            id: 'document.house.1847',
        };

        expect(BlueprintDocumentHash.of(reordered)).toBe(BlueprintDocumentHash.of(document));
    });

    it('changes when content changes', () => {
        const changed: BlueprintDocumentContent = { ...document, revision: 2 };

        expect(BlueprintDocumentHash.of(changed)).not.toBe(BlueprintDocumentHash.of(document));
    });

    it('omits undefined optional provenance fields', () => {
        const withUndefined = {
            ...document,
            provenance: { ...document.provenance, landmarkId: undefined },
        };

        expect(BlueprintDocumentHash.of(withUndefined)).toBe(BlueprintDocumentHash.of(document));
    });
});

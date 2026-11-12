import { describe, expect, it } from 'bun:test';

import { BlueprintComposer } from './blueprint-composer.js';
import type { BuildingBrief, BuildingBriefKind } from './blueprint-document.js';
import type { Blueprint } from './blueprint-ir.js';
import { BlueprintSupportValidator } from './blueprint-support.js';
import { BlueprintValidator } from './blueprint-validator.js';

const makeBrief = (kind: BuildingBriefKind, width = 9, depth = 7, storeys = 2): BuildingBrief => ({
    kind,
    size: { width, depth, storeys },
    program: {
        rooms: [
            { kind: 'main', count: 1, minimumSize: 3 },
            { kind: 'storage', count: 1, minimumSize: 2 },
        ],
        amenities: ['bed', 'chest', 'crafting_table', 'furnace', 'torch'],
    },
    style: {
        palette: 'oak_and_cobblestone',
        roof: 'gable',
        symmetry: 0.8,
        decoration: 0.5,
    },
    site: { connection: 'path' },
    seed: 1847,
});

const expectValid = (blueprint: Blueprint | null): void => {
    expect(blueprint === null).toBe(false);
    if (blueprint === null) return;
    expect(blueprint.blocks.length > 0).toBe(true);
    expect(blueprint.materials.length > 0).toBe(true);
    const [, validationError] = BlueprintValidator.validate(blueprint);
    expect(validationError).toBeNull();
    const [, supportError] = BlueprintSupportValidator.validate(blueprint);
    expect(supportError).toBeNull();
};

describe('BlueprintComposer', () => {
    it('composes every supported brief kind', () => {
        const composer = new BlueprintComposer();
        const briefs: readonly [BuildingBriefKind, BuildingBrief][] = [
            ['house', makeBrief('house')],
            ['shelter', makeBrief('shelter')],
            ['storage', makeBrief('storage')],
            ['workshop', makeBrief('workshop')],
            ['compound', makeBrief('compound', 11, 9)],
            ['watchtower', makeBrief('watchtower', 9, 7, 3)],
            ['farm', makeBrief('farm')],
            ['wall', makeBrief('wall')],
            ['road', makeBrief('road')],
            ['bridge', makeBrief('bridge', 9, 5, 1)],
        ];

        for (const [kind, brief] of briefs) {
            const [blueprint, error] = composer.compose({ id: `blueprint.${kind}`, brief });
            expect(error).toBeNull();
            expectValid(blueprint);
        }
    });

    it('replays the same blocks for the same brief and seed', () => {
        const composer = new BlueprintComposer();
        const brief = makeBrief('house');
        const [first, firstError] = composer.compose({ id: 'blueprint.house', brief });
        const [second, secondError] = composer.compose({ id: 'blueprint.house', brief });

        expect(firstError).toBeNull();
        expect(secondError).toBeNull();
        expect(JSON.stringify(first?.blocks)).toBe(JSON.stringify(second?.blocks));
    });

    it('varies decorated output with the seed', () => {
        const composer = new BlueprintComposer();
        const outputs = new Set<string>();
        const base = makeBrief('house');
        for (let seed = 1; seed <= 5; seed += 1) {
            const brief = { ...base, seed, style: { ...base.style, decoration: 1 } };
            const [blueprint, error] = composer.compose({ id: 'blueprint.house', brief });
            expect(error).toBeNull();
            outputs.add(JSON.stringify(blueprint?.blocks));
        }

        expect(outputs.size > 1).toBe(true);
    });

    it('applies the site anchor and rotation', () => {
        const composer = new BlueprintComposer();
        const brief = makeBrief('house');
        brief.site = { anchor: { x: 10, y: 20, z: 30 }, rotation: 90 };
        const [blueprint, error] = composer.compose({ id: 'blueprint.house', brief });

        expect(error).toBeNull();
        expect(blueprint?.anchor).toEqual({ x: 10, y: 20, z: 30 });
        expect(blueprint?.rotation).toBe(90);
        expectValid(blueprint ?? null);
    });

    it('enforces the block limit', () => {
        const composer = new BlueprintComposer({ maxBlocks: 10 });
        const [blueprint, error] = composer.compose({
            id: 'blueprint.house',
            brief: makeBrief('house'),
        });

        expect(blueprint).toBeNull();
        expect(error?.type).toBe('COMPOSE_FAILED');
    });

    it('rejects a brief that is too small', () => {
        const composer = new BlueprintComposer();
        const [blueprint, error] = composer.compose({
            id: 'blueprint.tiny',
            brief: makeBrief('house', 2, 2, 1),
        });

        expect(blueprint).toBeNull();
        expect(error?.type).toBe('COMPOSE_FAILED');
    });

    it('rejects an empty blueprint id', () => {
        const composer = new BlueprintComposer();
        const [blueprint, error] = composer.compose({ id: ' ', brief: makeBrief('house') });

        expect(blueprint).toBeNull();
        expect(error?.type).toBe('COMPOSE_FAILED');
    });
});

import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { BlueprintComposer } from './blueprint-composer.js';
import type { BuildingBrief } from './blueprint-document.js';
import {
    BlueprintSourceResolver,
    type BlueprintSourceResolverOptions,
} from './blueprint-source-resolver.js';
import { BuiltInTemplates } from './built-in-templates.js';
import type { BuildingFailure } from './failures.js';
import { ObservedBlueprintCapture } from './observed-blueprint.js';
import {
    type DecodedSchematic,
    type SchematicDecoderPort,
    SchematicParser,
} from './schematic-parser.js';
import { TemplateInstantiator } from './template-instantiator.js';

const brief: BuildingBrief = {
    kind: 'house',
    size: { width: 7, depth: 7, storeys: 1 },
    program: {
        rooms: [{ kind: 'main', count: 1, minimumSize: 2 }],
        amenities: ['torch'],
    },
    style: {
        palette: 'oak_and_cobblestone',
        roof: 'gable',
        symmetry: 0.8,
        decoration: 0.5,
    },
    site: {},
    seed: 1847,
};

class FakeSchematicDecoder implements SchematicDecoderPort {
    async decode(): Promise<Result<DecodedSchematic, BuildingFailure>> {
        return [
            {
                size: { x: 2, y: 1, z: 1 },
                blocks: [{ x: 1, y: 0, z: 0, stateName: 'stone' }],
            },
            null,
        ];
    }
}

const makeResolver = (allowRawBlockBlueprints: boolean): BlueprintSourceResolver | null => {
    const [registry, registryError] = BuiltInTemplates.createRegistry();
    expect(registryError).toBeNull();
    if (registry === null) return null;
    const options: BlueprintSourceResolverOptions = {
        templates: new TemplateInstantiator(registry),
        composer: new BlueprintComposer(),
        schematics: new SchematicParser(new FakeSchematicDecoder()),
        observation: new ObservedBlueprintCapture({
            world: { blockAt: () => [null, null] },
        }),
        allowRawBlockBlueprints,
    };
    return new BlueprintSourceResolver(options);
};

describe('BlueprintSourceResolver', () => {
    it('resolves a composed brief', async () => {
        const resolver = makeResolver(false);
        expect(resolver === null).toBe(false);
        if (resolver === null) return;

        const [blueprint, error] = await resolver.resolve({
            id: 'blueprint.composed',
            source: 'composed',
            brief,
        });

        expect(error).toBeNull();
        expect(blueprint?.id).toBe('blueprint.composed');
    });

    it('resolves a template request', async () => {
        const resolver = makeResolver(false);
        expect(resolver === null).toBe(false);
        if (resolver === null) return;

        const [blueprint, error] = await resolver.resolve({
            id: 'blueprint.template',
            source: 'template',
            anchor: { x: 0, y: 0, z: 0 },
            rotation: 0,
            template: 'house',
        });

        expect(error).toBeNull();
        expect(blueprint?.id).toBe('blueprint.template');
    });

    it('blocks raw block blueprints by default', async () => {
        const resolver = makeResolver(false);
        expect(resolver === null).toBe(false);
        if (resolver === null) return;

        const [blueprint, error] = await resolver.resolve({
            id: 'blueprint.raw',
            source: 'blocks',
            anchor: { x: 0, y: 0, z: 0 },
            rotation: 0,
            blocks: [{ x: 0, y: 0, z: 0, state: { name: 'stone' }, priority: 0 }],
        });

        expect(blueprint).toBeNull();
        expect(error?.type).toBe('RAW_BLUEPRINTS_DISABLED');
    });

    it('accepts connected raw blocks when enabled', async () => {
        const resolver = makeResolver(true);
        expect(resolver === null).toBe(false);
        if (resolver === null) return;

        const [blueprint, error] = await resolver.resolve({
            id: 'blueprint.raw',
            source: 'blocks',
            anchor: { x: 0, y: 0, z: 0 },
            rotation: 0,
            blocks: [
                { x: 0, y: 0, z: 0, state: { name: 'stone' }, priority: 0 },
                { x: 0, y: 1, z: 0, state: { name: 'stone' }, priority: 0 },
            ],
        });

        expect(error).toBeNull();
        expect(blueprint?.blocks).toHaveLength(2);
    });

    it('rotates a schematic around the anchor', async () => {
        const resolver = makeResolver(false);
        expect(resolver === null).toBe(false);
        if (resolver === null) return;

        const [blueprint, error] = await resolver.resolve({
            id: 'blueprint.schematic',
            source: 'schematic',
            anchor: { x: 10, y: 20, z: 30 },
            rotation: 90,
            buffer: Buffer.from('schematic'),
        });

        expect(error).toBeNull();
        expect(blueprint?.rotation).toBe(90);
        expect(blueprint?.blocks[0]).toEqual({
            x: 10,
            y: 20,
            z: 31,
            state: { name: 'stone' },
            priority: 0,
        });
    });
});

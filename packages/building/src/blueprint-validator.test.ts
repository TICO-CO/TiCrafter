import { describe, expect, it } from 'bun:test';

import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BlueprintRotation,
} from './blueprint-ir.js';
import { BlueprintValidator } from './blueprint-validator.js';

const BASE_BLOCKS: readonly BlueprintBlock[] = [
    { x: 0, y: 0, z: 0, state: { name: 'stone' }, priority: 0 },
    { x: 0, y: 1, z: 0, state: { name: 'oak_planks' }, priority: 1 },
];

const BASE_BLUEPRINT: Blueprint = {
    id: 'blueprint.test',
    anchor: { x: 0, y: 64, z: 0 },
    rotation: 0,
    blocks: BASE_BLOCKS,
    materials: [
        { item: 'stone', count: 1 },
        { item: 'oak_planks', count: 1 },
    ],
    constraints: [],
};

describe('BlueprintIr', () => {
    it('computes bounds and materials', () => {
        const [bounds, boundsError] = BlueprintIr.boundingBox(BASE_BLOCKS);

        expect(boundsError).toBeNull();
        expect(bounds).toEqual({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 1, z: 0 },
        });
        expect(BlueprintIr.materialNeeds(BASE_BLOCKS)).toEqual([
            { item: 'oak_planks', count: 1 },
            { item: 'stone', count: 1 },
        ]);
    });

    it('rotates and translates block positions', () => {
        const rotated = BlueprintIr.transform(
            { x: 1, y: 0, z: 0, state: { name: 'stone' }, priority: 0 },
            { x: 10, y: 64, z: 10 },
            90,
        );

        expect(rotated).toMatchObject({ x: 10, y: 64, z: 11 });
    });
});

describe('BlueprintValidator', () => {
    it('accepts a valid blueprint', () => {
        const [validated, validationError] = BlueprintValidator.validate(BASE_BLUEPRINT);

        expect(validationError).toBeNull();
        expect(validated?.id).toBe('blueprint.test');
    });

    it('rejects duplicate block positions', () => {
        const blueprint = {
            ...BASE_BLUEPRINT,
            blocks: [BASE_BLOCKS[0], BASE_BLOCKS[0]],
        } as Blueprint;

        const [validated, validationError] = BlueprintValidator.validate(blueprint);

        expect(validated).toBeNull();
        expect(validationError?.type).toBe('DUPLICATE_POSITION');
    });

    it('rejects under-declared materials', () => {
        const blueprint = {
            ...BASE_BLUEPRINT,
            materials: [{ item: 'stone', count: 1 }],
        };

        const [validated, validationError] = BlueprintValidator.validate(blueprint);

        expect(validated).toBeNull();
        expect(validationError?.type).toBe('INVALID_MATERIAL');
    });

    it('rejects protected regions and no-build zones', () => {
        const protectedResult = BlueprintValidator.validate(BASE_BLUEPRINT, {
            protectedBboxes: [
                {
                    min: { x: -1, y: -1, z: -1 },
                    max: { x: 1, y: 2, z: 1 },
                },
            ],
        });
        expect(protectedResult[1]?.type).toBe('PROTECTED_REGION');

        const zoneResult = BlueprintValidator.validate(BASE_BLUEPRINT, {
            noBuildZones: [
                [
                    { x: -1, y: 0, z: -1 },
                    { x: 2, y: 0, z: -1 },
                    { x: 0, y: 0, z: 2 },
                ],
            ],
        });
        expect(zoneResult[1]?.type).toBe('NO_BUILD_ZONE');
    });

    it('rejects invalid rotation and empty identifiers', () => {
        const invalidRotation = {
            ...BASE_BLUEPRINT,
            rotation: 45 as BlueprintRotation,
        };
        const rotationResult = BlueprintValidator.validate(invalidRotation);
        expect(rotationResult[1]?.type).toBe('INVALID_ROTATION');

        const emptyId = { ...BASE_BLUEPRINT, id: ' ' };
        const idResult = BlueprintValidator.validate(emptyId);
        expect(idResult[1]?.type).toBe('INVALID_BLUEPRINT');
    });
});

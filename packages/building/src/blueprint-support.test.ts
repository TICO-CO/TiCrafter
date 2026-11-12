import { describe, expect, it } from 'bun:test';

import type { Blueprint, BlueprintBlock } from './blueprint-ir.js';
import { BlueprintSupportValidator } from './blueprint-support.js';

const block = (x: number, y: number, z: number): BlueprintBlock => ({
    x,
    y,
    z,
    state: { name: 'stone' },
    priority: 0,
});

const blueprint = (blocks: readonly BlueprintBlock[]): Blueprint => ({
    id: 'blueprint.support',
    anchor: { x: 0, y: 0, z: 0 },
    rotation: 0,
    blocks,
    materials: [],
    constraints: [],
});

describe('BlueprintSupportValidator', () => {
    it('accepts blocks connected to the lowest layer', () => {
        const [result, error] = BlueprintSupportValidator.validate(
            blueprint([block(0, 0, 0), block(0, 1, 0), block(1, 1, 0)]),
        );

        expect(error).toBeNull();
        expect(result === undefined).toBe(true);
    });

    it('rejects a floating block', () => {
        const [, error] = BlueprintSupportValidator.validate(
            blueprint([block(0, 0, 0), block(4, 4, 4)]),
        );

        expect(error?.type).toBe('STRUCTURAL_FAILURE');
    });

    it('rejects a disconnected elevated island', () => {
        const [, error] = BlueprintSupportValidator.validate(
            blueprint([block(0, 0, 0), block(3, 4, 0), block(3, 5, 0)]),
        );

        expect(error?.type).toBe('STRUCTURAL_FAILURE');
    });
});

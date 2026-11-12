import { describe, expect, it } from 'bun:test';

import { BlueprintIr } from './blueprint-ir.js';
import type { ConstructionChange } from './construction-types.js';
import { WorkPackagePlanner } from './work-package-planner.js';

const change = (
    phase: ConstructionChange['phase'],
    position: { x: number; y: number; z: number },
    dependsOn: readonly string[] = [],
): ConstructionChange => ({
    kind: 'place',
    block: { ...position, state: { name: 'stone' }, priority: 0 },
    phase,
    reason: 'blueprint',
    dependsOn,
});

describe('WorkPackagePlanner', () => {
    it('keeps dependency chains ordered through predecessor packages', () => {
        const foundationPosition = { x: 0, y: 63, z: 0 };
        const wallPosition = { x: 0, y: 64, z: 0 };
        const foundation = change('foundation', foundationPosition);
        const wall = change('walls', wallPosition, [BlueprintIr.positionKey(foundationPosition)]);
        const [packages, packageError] = new WorkPackagePlanner().plan(
            [foundation, wall],
            [BlueprintIr.blockKey(foundation.block), BlueprintIr.blockKey(wall.block)],
            { maxBlocks: 1 },
        );

        expect(packageError).toBeNull();
        expect(packages).toHaveLength(2);
        const foundationPackage = packages?.find((entry) => entry.phase === 'foundation');
        const wallPackage = packages?.find((entry) => entry.phase === 'walls');
        expect(wallPackage?.predecessorIds).toEqual([foundationPackage?.id]);
    });

    it('keeps multi-block doors in one package', () => {
        const lowerPosition = { x: 0, y: 64, z: 0 };
        const upperPosition = { x: 0, y: 65, z: 0 };
        const lower: ConstructionChange = {
            ...change('openings', lowerPosition),
            block: {
                ...lowerPosition,
                state: { name: 'oak_door', properties: { half: 'lower' } },
                priority: 3,
            },
        };
        const upper: ConstructionChange = {
            ...change('openings', upperPosition, [BlueprintIr.positionKey(lowerPosition)]),
            block: {
                ...upperPosition,
                state: { name: 'oak_door', properties: { half: 'upper' } },
                priority: 3,
            },
        };
        const [packages, packageError] = new WorkPackagePlanner().plan(
            [lower, upper],
            [BlueprintIr.blockKey(lower.block), BlueprintIr.blockKey(upper.block)],
            { maxBlocks: 1 },
        );

        expect(packageError).toBeNull();
        expect(packages).toHaveLength(1);
        expect(packages?.[0]?.blockKeys).toHaveLength(2);
    });
});

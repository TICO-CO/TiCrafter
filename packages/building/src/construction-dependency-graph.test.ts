import { describe, expect, it } from 'bun:test';

import { BlueprintIr } from './blueprint-ir.js';
import { ConstructionDependencyGraph } from './construction-dependency-graph.js';
import type { ConstructionChange } from './construction-types.js';

const change = (
    kind: 'place' | 'break',
    position: { x: number; y: number; z: number },
    name: string,
    dependsOn: readonly string[] = [],
    properties?: Readonly<Record<string, string>>,
): ConstructionChange => ({
    kind,
    block: { ...position, state: { name, properties }, priority: 1 },
    phase: 'walls',
    reason: 'blueprint',
    dependsOn,
});

const key = (position: { x: number; y: number; z: number }): string =>
    BlueprintIr.positionKey(position);

describe('ConstructionDependencyGraph', () => {
    it('orders supports, wall attachments, doors, and beds', () => {
        const changes: ConstructionChange[] = [
            change('place', { x: 0, y: 64, z: 0 }, 'stone'),
            change('place', { x: 0, y: 65, z: 0 }, 'oak_planks'),
            change('place', { x: 1, y: 65, z: 0 }, 'wall_torch', [], { facing: 'east' }),
            change('place', { x: 2, y: 64, z: 0 }, 'oak_door', [], { half: 'lower' }),
            change('place', { x: 2, y: 65, z: 0 }, 'oak_door', [], { half: 'upper' }),
            change('place', { x: 3, y: 64, z: 0 }, 'red_bed', [], {
                facing: 'south',
                part: 'foot',
            }),
            change('place', { x: 3, y: 64, z: 1 }, 'red_bed', [], {
                facing: 'south',
                part: 'head',
            }),
        ];
        const [graph, graphError] = new ConstructionDependencyGraph().build(changes);

        expect(graphError).toBeNull();
        const order = graph?.order ?? [];
        expect(
            order.indexOf(key({ x: 0, y: 65, z: 0 })) > order.indexOf(key({ x: 0, y: 64, z: 0 })),
        ).toBe(true);
        expect(
            order.indexOf(key({ x: 1, y: 65, z: 0 })) > order.indexOf(key({ x: 0, y: 65, z: 0 })),
        ).toBe(true);
        expect(
            order.indexOf(key({ x: 2, y: 65, z: 0 })) > order.indexOf(key({ x: 2, y: 64, z: 0 })),
        ).toBe(true);
        expect(
            order.indexOf(key({ x: 3, y: 64, z: 1 })) > order.indexOf(key({ x: 3, y: 64, z: 0 })),
        ).toBe(true);
    });

    it('rejects dependency cycles', () => {
        const left = { x: 0, y: 64, z: 0 };
        const right = { x: 1, y: 64, z: 0 };
        const changes = [
            change('place', left, 'stone', [key(right)]),
            change('place', right, 'stone', [key(left)]),
        ];
        const [graph, graphError] = new ConstructionDependencyGraph().build(changes);

        expect(graph).toBeNull();
        expect(graphError?.type).toBe('INVALID_CONSTRUCTION_PLAN');
    });
});

import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { BlueprintMaterialNeed } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type ContainerCatalogPort,
    type ContainerView,
    type InventoryItemView,
    type InventoryQueryPort,
} from './material-preflight.js';
import {
    MaterialProcurementPlanner,
    type ProcurementCatalogPort,
} from './material-procurement-planner.js';

class FakeInventory implements InventoryQueryPort {
    constructor(private readonly items: readonly InventoryItemView[]) {}

    read(): Result<readonly InventoryItemView[], BuildingFailure> {
        return [this.items, null];
    }
}

class FakeContainers implements ContainerCatalogPort {
    constructor(private readonly containers: readonly ContainerView[]) {}

    list(): Result<readonly ContainerView[], BuildingFailure> {
        return [this.containers, null];
    }
}

class FakeCatalog implements ProcurementCatalogPort {
    recipeFor(item: string): Result<readonly BlueprintMaterialNeed[] | null, BuildingFailure> {
        if (item === 'stone') return [[{ item: 'cobblestone', count: 2 }], null];
        return [null, null];
    }

    sourceFor(item: string): Result<string | null, BuildingFailure> {
        if (item === 'dirt') return ['dig', null];
        return [null, null];
    }
}

describe('MaterialProcurementPlanner', () => {
    it('turns shortages into crafting and gathering requirements', () => {
        const planner = new MaterialProcurementPlanner(
            new FakeInventory([
                { name: 'torch', count: 1 },
                { name: 'stone', count: 2 },
            ]),
            new FakeContainers([
                {
                    id: 'container.1',
                    position: { x: 0, y: 64, z: 0 },
                    role: 'storage',
                    contents: [{ itemId: 'torch', count: 2 }],
                },
            ]),
            new FakeCatalog(),
        );
        const [plan, planError] = planner.plan(
            [
                { item: 'torch', count: 2 },
                { item: 'stone', count: 5 },
                { item: 'dirt', count: 3 },
            ],
            { x: 0, y: 64, z: 0 },
        );

        expect(planError).toBeNull();
        expect(plan?.crafting).toEqual([
            {
                item: 'stone',
                count: 3,
                ingredients: [{ item: 'cobblestone', count: 6 }],
            },
        ]);
        expect(plan?.gathering).toEqual([{ item: 'dirt', count: 3, source: 'dig' }]);
        expect(plan?.reservations).toHaveLength(1);
        expect(plan?.blocked).toBe(false);
    });

    it('blocks when a shortage has no recipe or gathering source', () => {
        const planner = new MaterialProcurementPlanner(
            new FakeInventory([]),
            new FakeContainers([]),
            new FakeCatalog(),
        );
        const [plan, planError] = planner.plan([{ item: 'diamond', count: 1 }]);

        expect(planError).toBeNull();
        expect(plan?.unresolved).toEqual([{ item: 'diamond', count: 1 }]);
        expect(plan?.blocked).toBe(true);
    });
});

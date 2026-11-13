import type {
    BlueprintMaterialNeed,
    BuildingFailure,
    ContainerView,
    ProcurementCatalogPort,
} from '@ticrafter/building';
import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { BuildingProcurementService } from './building-procurement-service.js';

class FakeCatalog implements ProcurementCatalogPort {
    recipeFor(item: string): Result<readonly BlueprintMaterialNeed[] | null, BuildingFailure> {
        if (item === 'stone') return [[{ item: 'cobblestone', count: 2 }], null];
        return [null, null];
    }

    sourceFor(item: string): Result<string | null, BuildingFailure> {
        if (item === 'dirt') return ['dirt', null];
        return [null, null];
    }

    smeltFor(item: string): Result<{ input: string; count: number } | null, BuildingFailure> {
        if (item === 'glass') return [{ input: 'sand', count: 2 }, null];
        return [null, null];
    }
}

class FakeContainers {
    constructor(readonly containers: ContainerView[]) {}

    list(): readonly ContainerView[] {
        return this.containers;
    }
}

const chest: ContainerView = {
    id: 'container.4.64.0',
    position: { x: 4, y: 64, z: 0 },
    role: 'storage',
    contents: [{ itemId: 'oak_planks', count: 2 }],
};

describe('BuildingProcurementService', () => {
    it('turns shortages into withdrawals, crafts, and gathering actions', () => {
        const containers = new FakeContainers([chest]);
        const service = new BuildingProcurementService(containers, new FakeCatalog());

        const [plan, error] = service.plan({
            needs: [
                { item: 'oak_planks', count: 2 },
                { item: 'stone', count: 1 },
                { item: 'dirt', count: 3 },
            ],
            inventory: [],
            position: { x: 0, y: 64, z: 0 },
        });

        expect(error).toBeNull();
        expect(plan?.actions).toEqual([
            {
                kind: 'withdraw',
                container: { x: 4, y: 64, z: 0 },
                item: 'oak_planks',
                count: 2,
            },
            { kind: 'gather', item: 'dirt', count: 3, source: 'dirt' },
            {
                kind: 'craft',
                item: 'stone',
                count: 1,
                ingredients: [{ item: 'cobblestone', count: 2 }],
            },
        ]);
        expect(plan?.blocked).toBe(false);
    });

    it('maps smelting requirements with their input counts', () => {
        const service = new BuildingProcurementService(new FakeContainers([]), new FakeCatalog());

        const [plan, error] = service.plan({
            needs: [{ item: 'glass', count: 3 }],
            inventory: [],
            position: { x: 0, y: 64, z: 0 },
        });

        expect(error).toBeNull();
        expect(plan?.actions).toEqual([
            {
                kind: 'smelt',
                item: 'glass',
                count: 3,
                input: 'sand',
                inputCount: 6,
                fuel: 'coal',
            },
        ]);
    });

    it('records completed withdrawals against the container snapshot', () => {
        const containers = new FakeContainers([chest]);
        const service = new BuildingProcurementService(containers, new FakeCatalog());
        const action = {
            kind: 'withdraw' as const,
            container: { x: 4, y: 64, z: 0 },
            item: 'oak_planks',
            count: 2,
        };

        service.record({ action, status: 'completed' });

        expect(containers.list()[0]?.contents).toEqual([]);
    });

    it('reports unresolved needs as blocked', () => {
        const service = new BuildingProcurementService(new FakeContainers([]), new FakeCatalog());

        const [plan, error] = service.plan({
            needs: [{ item: 'diamond', count: 1 }],
            inventory: [],
            position: { x: 0, y: 64, z: 0 },
        });

        expect(error).toBeNull();
        expect(plan?.blocked).toBe(true);
        expect(plan?.shortages).toEqual([{ item: 'diamond', count: 1 }]);
    });
});

import type { ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { ContainerRefillAdapter, type RefillTransfer } from './container-refill-adapter.js';
import type { BuildingFailure } from './failures.js';
import {
    type ContainerCatalogPort,
    type ContainerView,
    type InventoryItemView,
    type InventoryQueryPort,
    MaterialPreflight,
} from './material-preflight.js';

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

class TransferDispatcher {
    readonly requests: ActionRequest[] = [];

    dispatch(request: ActionRequest): Result<string, string> {
        this.requests.push(request);
        return [`transfer-${this.requests.length}`, null];
    }

    poll(): Result<ActionOutcome | null, string> {
        return [null, null];
    }

    cancel(): Result<void, string> {
        return [undefined, null];
    }
}

const CHEST: ContainerView = {
    id: 'container.chest',
    position: { x: 5, y: 64, z: 5 },
    role: 'storage',
    contents: [{ itemId: 'oak_planks', count: 3 }],
};

describe('MaterialPreflight', () => {
    it('covers needs from inventory and containers', () => {
        const preflight = new MaterialPreflight(
            new FakeInventory([{ name: 'oak_planks', count: 2 }]),
            new FakeContainers([CHEST]),
        );
        const [plan, planError] = preflight.check([{ item: 'oak_planks', count: 4 }], {
            x: 0,
            y: 64,
            z: 0,
        });

        expect(planError).toBeNull();
        expect(plan?.shortages).toHaveLength(0);
        expect(plan?.withdrawals).toHaveLength(1);
        expect(plan?.withdrawals[0]?.count).toBe(2);
        expect(plan?.available).toEqual([{ item: 'oak_planks', count: 5 }]);
    });

    it('reports uncovered shortages', () => {
        const preflight = new MaterialPreflight(
            new FakeInventory([{ name: 'oak_planks', count: 2 }]),
            new FakeContainers([CHEST]),
        );
        const [plan, planError] = preflight.check([{ item: 'oak_planks', count: 10 }]);

        expect(planError).toBeNull();
        expect(plan?.shortages).toEqual([{ item: 'oak_planks', count: 5 }]);
        expect(plan?.withdrawals[0]?.count).toBe(3);
    });

    it('reports surplus inventory', () => {
        const preflight = new MaterialPreflight(
            new FakeInventory([{ name: 'oak_planks', count: 10 }]),
            new FakeContainers([]),
        );
        const [plan, planError] = preflight.check([{ item: 'oak_planks', count: 4 }]);

        expect(planError).toBeNull();
        expect(plan?.surplus).toEqual([{ item: 'oak_planks', count: 6 }]);
    });
});

describe('ContainerRefillAdapter', () => {
    it('plans withdrawals and dispatches deposits', () => {
        const dispatcher = new TransferDispatcher();
        const adapter: ContainerRefillAdapter = new ContainerRefillAdapter(
            dispatcher,
            new FakeContainers([CHEST]),
        );
        const transfer: RefillTransfer = {
            direction: 'withdraw',
            container: CHEST.position,
            itemName: 'oak_planks',
            count: 2,
        };
        const [handleId, dispatchError] = adapter.dispatch(transfer);

        expect(dispatchError).toBeNull();
        expect(handleId).toBe('transfer-1');
        expect(dispatcher.requests[0]).toMatchObject({
            kind: 'transfer',
            direction: 'withdraw',
            itemName: 'oak_planks',
            count: 2,
        });
    });

    it('plans deposits into a storage container', () => {
        const dispatcher = new TransferDispatcher();
        const adapter = new ContainerRefillAdapter(dispatcher, new FakeContainers([CHEST]));
        const [transfers, transfersError] = adapter.planDeposits(
            [{ item: 'oak_planks', count: 6 }],
            { x: 0, y: 64, z: 0 },
        );

        expect(transfersError).toBeNull();
        expect(transfers).toHaveLength(1);
        expect(transfers?.[0]?.container).toEqual({ x: 5, y: 64, z: 5 });
    });

    it('fails closed without a container', () => {
        const adapter = new ContainerRefillAdapter(
            new TransferDispatcher(),
            new FakeContainers([]),
        );
        const [transfers, transfersError] = adapter.planDeposits([
            { item: 'oak_planks', count: 6 },
        ]);

        expect(transfers).toBeNull();
        expect(transfersError?.type).toBe('WORLD_QUERY_FAILED');
    });
});

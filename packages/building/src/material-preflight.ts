import type { Result, Vec3 } from '@ticrafter/core';

import type { BlueprintMaterialNeed } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export interface InventoryItemView {
    name: string;
    count: number;
}

export interface InventoryQueryPort {
    read(): Result<readonly InventoryItemView[], BuildingFailure>;
}

export interface ContainerItemView {
    itemId: string;
    count: number;
}

export interface ContainerView {
    id: string;
    position: Vec3;
    role: string;
    contents: readonly ContainerItemView[] | null;
}

export interface ContainerCatalogPort {
    list(): Result<readonly ContainerView[], BuildingFailure>;
}

export interface MaterialWithdrawal {
    containerId: string;
    position: Vec3;
    item: string;
    count: number;
}

export interface MaterialPlan {
    needs: readonly BlueprintMaterialNeed[];
    available: readonly BlueprintMaterialNeed[];
    shortages: readonly BlueprintMaterialNeed[];
    withdrawals: readonly MaterialWithdrawal[];
    surplus: readonly BlueprintMaterialNeed[];
}

export class MaterialPreflight {
    constructor(
        private readonly inventory: InventoryQueryPort,
        private readonly containers: ContainerCatalogPort,
    ) {}

    check(
        needs: readonly BlueprintMaterialNeed[],
        botPosition?: Vec3,
    ): Result<MaterialPlan, BuildingFailure> {
        const [inventory, inventoryError] = this.inventory.read();
        if (inventoryError) return [null, inventoryError];
        if (inventory === null) {
            return [null, { type: 'WORLD_QUERY_FAILED', message: 'inventory returned null' }];
        }
        const [containers, containerError] = this.containers.list();
        if (containerError) return [null, containerError];
        if (containers === null) {
            return [null, { type: 'WORLD_QUERY_FAILED', message: 'containers returned null' }];
        }
        const inventoryCounts = this.counts(
            inventory,
            (item) => item.name,
            (item) => item.count,
        );
        const containerCounts = this.containerCounts(containers);
        const available = this.available(needs, inventoryCounts, containerCounts);
        const shortages: BlueprintMaterialNeed[] = [];
        const withdrawals: MaterialWithdrawal[] = [];
        const sortedContainers = this.sortContainers(containers, botPosition);
        needs.forEach((need) => {
            let remaining = need.count - (inventoryCounts.get(need.item) ?? 0);
            remaining = this.withdraw(need.item, remaining, sortedContainers, withdrawals);
            if (remaining > 0) shortages.push({ item: need.item, count: remaining });
        });
        return [
            {
                needs,
                available,
                shortages,
                withdrawals,
                surplus: this.surplus(inventoryCounts, needs),
            },
            null,
        ];
    }

    private withdraw(
        item: string,
        remaining: number,
        containers: readonly ContainerView[],
        withdrawals: MaterialWithdrawal[],
    ): number {
        let outstanding = remaining;
        for (const container of containers) {
            if (outstanding <= 0) break;
            const available = (container.contents ?? [])
                .filter((entry) => entry.itemId === item)
                .reduce((total, entry) => total + entry.count, 0);
            if (available <= 0) continue;
            const count = Math.min(available, outstanding);
            withdrawals.push({
                containerId: container.id,
                position: container.position,
                item,
                count,
            });
            outstanding -= count;
        }
        return outstanding;
    }

    private available(
        needs: readonly BlueprintMaterialNeed[],
        inventory: ReadonlyMap<string, number>,
        containers: ReadonlyMap<string, number>,
    ): readonly BlueprintMaterialNeed[] {
        return needs.map((need) => ({
            item: need.item,
            count: (inventory.get(need.item) ?? 0) + (containers.get(need.item) ?? 0),
        }));
    }

    private surplus(
        inventory: ReadonlyMap<string, number>,
        needs: readonly BlueprintMaterialNeed[],
    ): readonly BlueprintMaterialNeed[] {
        const required = new Map(needs.map((need) => [need.item, need.count]));
        return [...inventory.entries()]
            .map(([item, count]) => ({ item, count: count - (required.get(item) ?? 0) }))
            .filter((entry) => entry.count > 0)
            .sort((left, right) => left.item.localeCompare(right.item));
    }

    private containerCounts(containers: readonly ContainerView[]): ReadonlyMap<string, number> {
        const counts = new Map<string, number>();
        containers.forEach((container) => {
            (container.contents ?? []).forEach((entry) => {
                counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + entry.count);
            });
        });
        return counts;
    }

    private counts<T>(
        items: readonly T[],
        keyFor: (item: T) => string,
        countFor: (item: T) => number,
    ): ReadonlyMap<string, number> {
        const counts = new Map<string, number>();
        items.forEach((item) => {
            const key = keyFor(item);
            counts.set(key, (counts.get(key) ?? 0) + countFor(item));
        });
        return counts;
    }

    private sortContainers(
        containers: readonly ContainerView[],
        botPosition?: Vec3,
    ): readonly ContainerView[] {
        if (botPosition === undefined) return containers;
        return [...containers].sort(
            (left, right) =>
                this.distance(botPosition, left.position) -
                this.distance(botPosition, right.position),
        );
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}

import type { HeadlessInventoryPort } from '@ticrafter/bot/headless';
import type { BuildingFailure, InventoryItemView, InventoryQueryPort } from '@ticrafter/building';
import type { Result } from '@ticrafter/core';

export interface FakeInventoryOptions {
    contents?: Readonly<Record<string, number>>;
    slotCapacity?: number;
}

export class FakeInventory implements HeadlessInventoryPort, InventoryQueryPort {
    private readonly counts = new Map<string, number>();
    private readonly slotCapacity: number;

    constructor(options: FakeInventoryOptions = {}) {
        this.slotCapacity = options.slotCapacity ?? 36;
        Object.entries(options.contents ?? {}).forEach(([name, count]) => {
            if (count > 0) this.counts.set(name, count);
        });
    }

    items(): readonly { name: string; count: number }[] {
        return [...this.counts.entries()].map(([name, count]) => ({ name, count }));
    }

    count(name: string): number {
        return this.counts.get(name) ?? 0;
    }

    add(name: string, count: number): Result<void, string> {
        if (count <= 0) return [null, 'inventory add requires a positive count'];
        const current = this.count(name);
        if (current === 0 && this.counts.size >= this.slotCapacity) {
            return [null, 'inventory is full'];
        }
        this.counts.set(name, current + count);
        return [undefined, null];
    }

    remove(name: string, count: number): Result<void, string> {
        if (count <= 0) return [null, 'inventory remove requires a positive count'];
        const current = this.count(name);
        if (current < count) return [null, `missing item ${name}`];
        if (current === count) this.counts.delete(name);
        else this.counts.set(name, current - count);
        return [undefined, null];
    }

    read(): Result<readonly InventoryItemView[], BuildingFailure> {
        return [this.items(), null];
    }
}

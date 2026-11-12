import type { ContainerRefreshPort } from '@ticrafter/bot/headless';
import type { ContainerView } from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';

export interface FakeContainerSpec {
    position: Vec3;
    role?: string;
    contents?: Readonly<Record<string, number>>;
}

export class FakeContainers implements ContainerRefreshPort {
    private readonly containers: ContainerView[];

    constructor(specs: readonly FakeContainerSpec[] = []) {
        this.containers = specs.map((spec, index) => ({
            id: `container.${index}`,
            position: { ...spec.position },
            role: spec.role ?? 'storage',
            contents: Object.entries(spec.contents ?? {}).map(([itemId, count]) => ({
                itemId,
                count,
            })),
        }));
    }

    list(): readonly ContainerView[] {
        return this.containers;
    }

    refresh(): Promise<Result<readonly ContainerView[], string>> {
        return Promise.resolve([this.containers, null]);
    }

    withdraw(position: Vec3, itemName: string, count: number): Result<void, string> {
        const container = this.find(position);
        if (container === null || container.contents === null) {
            return [null, 'container is unavailable'];
        }
        let remaining = count;
        const next = container.contents
            .map((entry) => {
                if (entry.itemId !== itemName || remaining <= 0) return entry;
                const consumed = Math.min(entry.count, remaining);
                remaining -= consumed;
                return { ...entry, count: entry.count - consumed };
            })
            .filter((entry) => entry.count > 0);
        if (remaining > 0) return [null, `container is missing ${itemName}`];
        this.replace(container, next);
        return [undefined, null];
    }

    deposit(position: Vec3, itemName: string, count: number): Result<void, string> {
        const container = this.find(position);
        if (container === null) return [null, 'container is unavailable'];
        const next = [...(container.contents ?? [])];
        const existing = next.find((entry) => entry.itemId === itemName);
        if (existing === undefined) next.push({ itemId: itemName, count });
        else existing.count += count;
        this.replace(container, next);
        return [undefined, null];
    }

    private find(position: Vec3): ContainerView | null {
        return (
            this.containers.find(
                (candidate) =>
                    candidate.position.x === position.x &&
                    candidate.position.y === position.y &&
                    candidate.position.z === position.z,
            ) ?? null
        );
    }

    private replace(
        container: ContainerView,
        contents: readonly { itemId: string; count: number }[],
    ): void {
        (container as { contents: readonly { itemId: string; count: number }[] | null }).contents =
            contents;
    }
}

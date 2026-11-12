import type { ContainerView } from '@ticrafter/building';
import { attemptAsync, type Result, type Vec3 } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

const CONTAINER_BLOCKS = ['chest', 'trapped_chest', 'barrel', 'furnace'];
const DEFAULT_MAX_DISTANCE = 32;
const DEFAULT_MAX_CONTAINERS = 8;

interface ContainerSlotItem {
    name: string;
    count: number;
}

interface OpenContainerView {
    slots: readonly (ContainerSlotItem | null | undefined)[];
    inventoryStart: number;
    close(): Promise<void>;
}

export interface ContainerScannerOptions {
    maxDistance?: number;
    maxContainers?: number;
}

export class ContainerScanner {
    private containers: readonly ContainerView[] = [];

    constructor(
        private readonly bot: Bot,
        private readonly options: ContainerScannerOptions = {},
    ) {}

    list(): readonly ContainerView[] {
        return this.containers;
    }

    async refresh(): Promise<Result<readonly ContainerView[], string>> {
        const blockIds = CONTAINER_BLOCKS.map(
            (name) => this.bot.registry.blocksByName[name]?.id,
        ).filter((id): id is number => id !== undefined);
        if (blockIds.length === 0) {
            this.containers = [];
            return [[], null];
        }
        const maxDistance = this.options.maxDistance ?? DEFAULT_MAX_DISTANCE;
        const maxContainers = this.options.maxContainers ?? DEFAULT_MAX_CONTAINERS;
        const blocks = this.bot.findBlocks({
            matching: blockIds,
            maxDistance,
            count: maxContainers,
        });
        const containers: ContainerView[] = [];
        for (const found of blocks) {
            const block = this.bot.blockAt(found);
            if (block === null) continue;
            const [contents, contentsError] = await this.read(block);
            if (contentsError !== null) continue;
            if (contents === null) continue;
            const position: Vec3 = {
                x: block.position.x,
                y: block.position.y,
                z: block.position.z,
            };
            containers.push({
                id: `container.${position.x}.${position.y}.${position.z}`,
                position,
                role: block.name === 'furnace' ? 'fuel' : 'storage',
                contents,
            });
        }
        this.containers = containers;
        return [containers, null];
    }

    private async read(block: {
        name: string;
        position: { x: number; y: number; z: number };
    }): Promise<Result<readonly { itemId: string; count: number }[] | null, string>> {
        const [opened, openError] = await attemptAsync(() =>
            this.bot.openContainer(block as Parameters<Bot['openContainer']>[0]),
        );
        if (openError || opened === null) return [null, null];
        const container = opened as unknown as OpenContainerView;
        const contents = container.slots
            .slice(0, container.inventoryStart)
            .filter((item): item is ContainerSlotItem => item !== null && item !== undefined)
            .map((item) => ({ itemId: item.name, count: item.count }));
        const [, closeError] = await attemptAsync(() => container.close());
        if (closeError) return [null, null];
        return [contents, null];
    }
}

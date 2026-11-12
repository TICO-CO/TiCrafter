import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { ContainerScanner } from './container-scanner.js';

interface FakeItem {
    name: string;
    count: number;
}

function botWithContainer(slots: readonly (FakeItem | null)[]): Bot {
    const position = { x: 4, y: 64, z: 0 };
    const block = { name: 'chest', position };
    return {
        registry: {
            blocksByName: {
                chest: { id: 1 },
                trapped_chest: { id: 2 },
                barrel: { id: 3 },
                furnace: { id: 4 },
            },
        },
        findBlocks: () => [position],
        blockAt: () => block,
        openContainer: () =>
            Promise.resolve({
                slots,
                inventoryStart: 27,
                close: () => Promise.resolve(),
            }),
    } as unknown as Bot;
}

describe('ContainerScanner', () => {
    it('snapshots container contents before the inventory slots', async () => {
        const scanner = new ContainerScanner(
            botWithContainer([{ name: 'oak_planks', count: 2 }, null, { name: 'torch', count: 3 }]),
        );

        const [containers, error] = await scanner.refresh();

        expect(error).toBeNull();
        expect(containers).toEqual([
            {
                id: 'container.4.64.0',
                position: { x: 4, y: 64, z: 0 },
                role: 'storage',
                contents: [
                    { itemId: 'oak_planks', count: 2 },
                    { itemId: 'torch', count: 3 },
                ],
            },
        ]);
        expect(scanner.list()).toHaveLength(1);
    });
});

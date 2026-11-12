import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { MineflayerProcurementCatalog } from './procurement-catalog.js';

function fakeBot(): Bot {
    return {
        registry: {
            itemsByName: {
                oak_planks: { id: 1 },
                stone: { id: 2 },
                dirt: { id: 3 },
            },
            blocksByName: {
                oak_log: { id: 10 },
                dirt: { id: 11 },
                stone: { id: 12 },
            },
            items: {
                1: { name: 'oak_planks' },
                2: { name: 'oak_log' },
                10: { name: 'oak_log' },
                11: { name: 'dirt' },
                12: { name: 'stone' },
            },
        },
        recipesAll: (itemType: number) => {
            if (itemType !== 1) return [];
            return [
                {
                    delta: [
                        { id: 2, count: -1 },
                        { id: 1, count: 4 },
                    ],
                },
            ];
        },
    } as unknown as Bot;
}

describe('MineflayerProcurementCatalog', () => {
    it('returns recipe ingredients for craftable items', () => {
        const catalog = new MineflayerProcurementCatalog(fakeBot());

        const [ingredients, error] = catalog.recipeFor('oak_planks');

        expect(error).toBeNull();
        expect(ingredients).toEqual([{ item: 'oak_log', count: 1 }]);
    });

    it('maps item names to gather sources', () => {
        const catalog = new MineflayerProcurementCatalog(fakeBot());

        expect(catalog.sourceFor('oak_log')).toEqual(['oak_log', null]);
        expect(catalog.sourceFor('coal')).toEqual(['coal_ore', null]);
        expect(catalog.sourceFor('cobblestone')).toEqual(['stone', null]);
        expect(catalog.sourceFor('diamond')).toEqual(['diamond_ore', null]);
    });

    it('fails closed for unknown recipes and sources', () => {
        const catalog = new MineflayerProcurementCatalog(fakeBot());

        expect(catalog.recipeFor('dirt')).toEqual([null, null]);
        expect(catalog.sourceFor('diamond_sword')).toEqual([null, null]);
    });
});

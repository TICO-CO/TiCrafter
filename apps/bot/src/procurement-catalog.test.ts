import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { MineflayerProcurementCatalog } from './procurement-catalog.js';

function fakeBot(): Bot {
    return {
        registry: {
            itemsByName: {
                oak_planks: { id: 1 },
                oak_log: { id: 2 },
                stone: { id: 3 },
                dirt: { id: 4 },
                birch_door: { id: 5 },
                birch_planks: { id: 6 },
                brick: { id: 7 },
                clay_ball: { id: 8 },
                sand: { id: 9 },
                glass: { id: 10 },
                white_wool: { id: 11 },
            },
            blocksByName: {
                oak_log: { id: 20 },
                dirt: { id: 21 },
                stone: { id: 22 },
                birch_door: { id: 23 },
                clay: { id: 24 },
                sand: { id: 25 },
                glass: { id: 26 },
            },
            items: {
                1: { name: 'oak_planks' },
                2: { name: 'oak_log' },
                3: { name: 'stone' },
                4: { name: 'dirt' },
                5: { name: 'birch_door' },
                6: { name: 'birch_planks' },
                7: { name: 'brick' },
                8: { name: 'clay_ball' },
                9: { name: 'sand' },
                10: { name: 'glass' },
                11: { name: 'white_wool' },
                20: { name: 'oak_log' },
                21: { name: 'dirt' },
                22: { name: 'stone' },
                24: { name: 'clay' },
                25: { name: 'sand' },
                26: { name: 'glass' },
            },
            recipes: {
                5: [
                    {
                        inShape: [
                            [6, 6],
                            [6, 6],
                            [6, 6],
                        ],
                        result: { id: 5, count: 3 },
                    },
                ],
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

    it('falls back to registry recipes for table-only crafting recipes', () => {
        const catalog = new MineflayerProcurementCatalog(fakeBot());

        expect(catalog.recipeFor('birch_door')).toEqual([
            [{ item: 'birch_planks', count: 2 }],
            null,
        ]);
        expect(catalog.sourceFor('birch_door')).toEqual([null, null]);
    });

    it('classifies smelted materials and animal drops', () => {
        const catalog = new MineflayerProcurementCatalog(fakeBot());

        expect(catalog.smeltFor('glass')).toEqual([{ input: 'sand', count: 1 }, null]);
        expect(catalog.smeltFor('brick')).toEqual([{ input: 'clay_ball', count: 1 }, null]);
        expect(catalog.sourceFor('white_wool')).toEqual(['entity:sheep', null]);
        expect(catalog.sourceFor('glass')).toEqual([null, null]);
        expect(catalog.sourceFor('brick')).toEqual([null, null]);
    });

    it('fails closed for unknown recipes and sources', () => {
        const catalog = new MineflayerProcurementCatalog(fakeBot());

        expect(catalog.recipeFor('dirt')).toEqual([null, null]);
        expect(catalog.sourceFor('diamond_sword')).toEqual([null, null]);
        expect(catalog.smeltFor('diamond')).toEqual([null, null]);
    });
});

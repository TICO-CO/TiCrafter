import type { Result } from '@ticrafter/core';

import type { MaterialNeed } from './progression-types.js';

export interface InventoryEntry {
    name: string;
    count: number;
}

export interface RecipePort {
    canCraft(item: string, inventory: readonly InventoryEntry[]): boolean;
    ingredients(item: string): readonly MaterialNeed[];
    station(item: string): 'none' | 'crafting_table' | 'furnace';
}

const RECIPES: Readonly<Record<string, readonly MaterialNeed[]>> = {
    oak_planks: [{ item: 'oak_log', count: 1 }],
    stick: [{ item: 'oak_planks', count: 2 }],
    crafting_table: [{ item: 'oak_planks', count: 4 }],
    wooden_pickaxe: [
        { item: 'oak_planks', count: 3 },
        { item: 'stick', count: 2 },
    ],
    wooden_sword: [
        { item: 'oak_planks', count: 2 },
        { item: 'stick', count: 1 },
    ],
    stone_pickaxe: [
        { item: 'cobblestone', count: 3 },
        { item: 'stick', count: 2 },
    ],
    stone_sword: [
        { item: 'cobblestone', count: 2 },
        { item: 'stick', count: 1 },
    ],
    furnace: [{ item: 'cobblestone', count: 8 }],
    chest: [{ item: 'oak_planks', count: 8 }],
    red_bed: [
        { item: 'oak_planks', count: 3 },
        { item: 'white_wool', count: 3 },
    ],
};

const TABLE_ITEMS = new Set([
    'wooden_pickaxe',
    'wooden_sword',
    'stone_pickaxe',
    'stone_sword',
    'furnace',
    'chest',
    'red_bed',
]);

export class StaticRecipePort implements RecipePort {
    canCraft(item: string, inventory: readonly InventoryEntry[]): boolean {
        if (inventory.some((entry) => entry.name === item)) return true;
        const ingredients = this.ingredients(item);
        if (ingredients.length === 0) return false;
        return ingredients.every(
            (need) => inventory.find((entry) => entry.name === need.item)?.count ?? 0 >= need.count,
        );
    }

    ingredients(item: string): readonly MaterialNeed[] {
        return RECIPES[item] ?? [];
    }

    station(item: string): 'none' | 'crafting_table' | 'furnace' {
        if (item === 'furnace') return 'crafting_table';
        return TABLE_ITEMS.has(item) ? 'crafting_table' : 'none';
    }
}

export class RecipeCatalog {
    static canCraft(
        port: RecipePort,
        item: string,
        inventory: readonly InventoryEntry[],
    ): Result<boolean, string> {
        if (item.length === 0) return [null, 'recipe item is required'];
        return [port.canCraft(item, inventory), null];
    }
}

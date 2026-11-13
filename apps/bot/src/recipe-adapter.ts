import type { InventoryEntry, MaterialNeed, RecipePort } from '@ticrafter/agency';
import type { Bot } from 'mineflayer';

interface RecipeEntry {
    requiresTable?: boolean;
    delta?: readonly { id?: number; count?: number }[];
}

export class MineflayerRecipePort implements RecipePort {
    constructor(private readonly bot: Bot) {}

    canCraft(item: string, inventory: readonly InventoryEntry[]): boolean {
        const recipes = this.availableRecipes(item);
        if (recipes.length === 0) return false;
        return this.ingredients(item).every(
            (need) => inventory.find((entry) => entry.name === need.item)?.count ?? 0 >= need.count,
        );
    }

    ingredients(item: string): readonly MaterialNeed[] {
        const recipe = this.availableRecipes(item)[0];
        if (recipe === undefined) return [];
        return (recipe.delta ?? [])
            .filter((entry) => (entry.count ?? 0) < 0)
            .map((entry) => ({
                item: this.itemName(entry.id),
                count: Math.abs(entry.count ?? 0),
            }))
            .filter((need) => need.item.length > 0);
    }

    station(item: string): 'none' | 'crafting_table' | 'furnace' {
        const itemType = this.bot.registry.itemsByName[item];
        if (itemType === undefined) return 'none';
        const withoutTable = this.bot.recipesAll(itemType.id, null, false);
        if (withoutTable.some((recipe) => recipe.requiresTable !== true)) return 'none';
        return 'crafting_table';
    }

    private availableRecipes(item: string): readonly RecipeEntry[] {
        const itemType = this.bot.registry.itemsByName[item];
        if (itemType === undefined) return [];
        const result = this.bot.recipesAll(itemType.id, null, true);
        return Array.isArray(result) ? (result as unknown as readonly RecipeEntry[]) : [];
    }

    private itemName(id: number | undefined): string {
        if (id === undefined) return '';
        return this.bot.registry.items[id]?.name ?? '';
    }
}

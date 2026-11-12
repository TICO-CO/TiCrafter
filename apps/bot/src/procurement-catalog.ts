import {
    type BlueprintMaterialNeed,
    type BuildingFailure,
    type ProcurementCatalogPort,
} from '@ticrafter/building';
import { attempt, type Result } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

const BLOCK_SOURCES: Readonly<Record<string, string>> = {
    coal: 'coal_ore',
    cobblestone: 'stone',
    diamond: 'diamond_ore',
    emerald: 'emerald_ore',
    lapis_lazuli: 'lapis_ore',
    raw_copper: 'copper_ore',
    raw_gold: 'gold_ore',
    raw_iron: 'iron_ore',
    redstone: 'redstone_ore',
};

interface RecipeDelta {
    id: number;
    count: number;
}

interface RecipeView {
    delta: readonly RecipeDelta[];
}

interface RecipeBot {
    recipesAll(
        itemType: number,
        metadata: null,
        sourceOnly: boolean,
    ): readonly RecipeView[] | null | undefined;
}

export class MineflayerProcurementCatalog implements ProcurementCatalogPort {
    constructor(private readonly bot: Bot) {}

    recipeFor(item: string): Result<readonly BlueprintMaterialNeed[] | null, BuildingFailure> {
        const itemType = this.bot.registry.itemsByName[item];
        if (itemType === undefined) return [null, null];
        const [recipes, recipeError] = attempt(() =>
            (this.bot as unknown as RecipeBot).recipesAll(itemType.id, null, false),
        );
        if (recipeError) return [null, null];
        const recipe = recipes?.[0];
        if (recipe === undefined) return [null, null];
        const ingredients: BlueprintMaterialNeed[] = [];
        recipe.delta.forEach((entry) => {
            if (entry.count >= 0) return;
            const ingredient = this.bot.registry.items[entry.id]?.name;
            if (ingredient === undefined) return;
            ingredients.push({ item: ingredient, count: -entry.count });
        });
        if (ingredients.length === 0) return [null, null];
        return [ingredients, null];
    }

    sourceFor(item: string): Result<string | null, BuildingFailure> {
        const mapped = BLOCK_SOURCES[item];
        if (mapped !== undefined) return [mapped, null];
        if (this.bot.registry.blocksByName[item] === undefined) return [null, null];
        return [item, null];
    }
}

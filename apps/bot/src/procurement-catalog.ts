import {
    type BlueprintMaterialNeed,
    type BuildingFailure,
    type ProcurementCatalogPort,
} from '@ticrafter/building';
import { attempt, type Result } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

const BLOCK_SOURCES: Readonly<Record<string, string>> = {
    clay_ball: 'clay',
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

const ENTITY_SOURCES: Readonly<Record<string, string>> = {
    white_wool: 'sheep',
};

const SMELT_SOURCES: Readonly<Record<string, string>> = {
    brick: 'clay_ball',
    glass: 'sand',
    smooth_sandstone: 'sandstone',
};

const NATURAL_BLOCKS = new Set([
    'andesite',
    'basalt',
    'blackstone',
    'calcite',
    'clay',
    'cobblestone',
    'deepslate',
    'diorite',
    'dirt',
    'end_stone',
    'granite',
    'gravel',
    'netherrack',
    'obsidian',
    'sand',
    'sandstone',
    'snow',
    'snow_block',
    'stone',
    'tuff',
]);

interface RecipeDelta {
    id: number;
    count: number;
}

interface RecipeView {
    delta: readonly RecipeDelta[];
    result?: { id?: number; count?: number } | null;
}

interface RegistryRecipe {
    ingredients?: readonly (number | null | undefined)[];
    inShape?: readonly (readonly (number | null | undefined)[])[];
    result?: { id?: number; count?: number } | null;
}

interface RegistryData {
    items?: Record<string, { name?: string } | undefined>;
    recipes?: Record<string, readonly RegistryRecipe[] | undefined>;
}

interface RecipeBot {
    recipesAll(
        itemType: number,
        metadata: null,
        sourceOnly: boolean,
    ): readonly RecipeView[] | null | undefined;
    registry?: RegistryData;
}

export class MineflayerProcurementCatalog implements ProcurementCatalogPort {
    constructor(private readonly bot: Bot) {}

    recipeFor(item: string): Result<readonly BlueprintMaterialNeed[] | null, BuildingFailure> {
        if (ENTITY_SOURCES[item] !== undefined) return [null, null];
        const recipeBot = this.bot as unknown as RecipeBot;
        const itemType = this.bot.registry.itemsByName[item];
        if (itemType === undefined) return [null, null];
        const [recipes, recipeError] = attempt(() =>
            recipeBot.recipesAll(itemType.id, null, false),
        );
        if (recipeError) return [null, null];
        const recipe = recipes?.[0];
        const fromDelta =
            recipe === undefined
                ? []
                : this.ingredientsFromDelta(recipe, recipe.result?.count ?? 1);
        if (fromDelta.length > 0) return [fromDelta, null];
        const fromRegistry = this.ingredientsFromRegistry(recipeBot.registry, itemType.id);
        if (fromRegistry.length === 0) return [null, null];
        return [fromRegistry, null];
    }

    sourceFor(item: string): Result<string | null, BuildingFailure> {
        const entity = ENTITY_SOURCES[item];
        if (entity !== undefined) return [`entity:${entity}`, null];
        const mapped = BLOCK_SOURCES[item];
        if (mapped !== undefined) return [mapped, null];
        const [recipe, recipeError] = this.recipeFor(item);
        if (recipeError !== null || recipe !== null) return [null, null];
        const itemType = this.bot.registry.itemsByName[item];
        if (itemType === undefined) return [null, null];
        if (this.bot.registry.blocksByName[item] === undefined) return [null, null];
        if (!MineflayerProcurementCatalog.naturalBlock(item)) return [null, null];
        return [item, null];
    }

    smeltFor(item: string): Result<{ input: string; count: number } | null, BuildingFailure> {
        const input = SMELT_SOURCES[item];
        if (input === undefined) return [null, null];
        return [{ input, count: 1 }, null];
    }

    private static naturalBlock(item: string): boolean {
        return (
            NATURAL_BLOCKS.has(item) ||
            item.endsWith('_log') ||
            item.endsWith('_wood') ||
            item.endsWith('_ore') ||
            item.endsWith('_stem') ||
            item.endsWith('_hyphae')
        );
    }

    private ingredientsFromDelta(
        recipe: RecipeView,
        outputCount: number,
    ): readonly BlueprintMaterialNeed[] {
        const ingredients: BlueprintMaterialNeed[] = [];
        recipe.delta.forEach((entry) => {
            if (entry.count >= 0) return;
            const ingredient = this.bot.registry.items[entry.id]?.name;
            if (ingredient === undefined) return;
            ingredients.push({
                item: ingredient,
                count: MineflayerProcurementCatalog.perOutput(-entry.count, outputCount),
            });
        });
        return ingredients;
    }

    private ingredientsFromRegistry(
        registry: RegistryData | undefined,
        itemTypeId: number,
    ): readonly BlueprintMaterialNeed[] {
        const recipe = registry?.recipes?.[String(itemTypeId)]?.[0];
        if (recipe === undefined) return [];
        const itemIds = recipe.inShape?.flat() ?? recipe.ingredients ?? [];
        const counts = new Map<string, number>();
        itemIds.forEach((itemId) => {
            if (typeof itemId !== 'number' || itemId <= 0) return;
            const itemName = registry?.items?.[String(itemId)]?.name;
            if (itemName === undefined) return;
            counts.set(itemName, (counts.get(itemName) ?? 0) + 1);
        });
        const outputCount = recipe.result?.count ?? 1;
        return [...counts.entries()]
            .map(([itemName, count]) => ({
                item: itemName,
                count: MineflayerProcurementCatalog.perOutput(count, outputCount),
            }))
            .sort((left, right) => left.item.localeCompare(right.item));
    }

    private static perOutput(count: number, outputCount: number): number {
        if (outputCount <= 0) return count;
        return Math.ceil(count / outputCount);
    }
}

import type {
    BlueprintMaterialNeed,
    BuildingFailure,
    ProcurementCatalogPort,
} from '@ticrafter/building';
import type { Result } from '@ticrafter/core';

export interface FakeRecipe {
    item: string;
    ingredients: readonly BlueprintMaterialNeed[];
}

export interface FakeProcurementOptions {
    recipes?: readonly FakeRecipe[];
    sources?: Readonly<Record<string, string>>;
}

export class FakeProcurementCatalog implements ProcurementCatalogPort {
    private readonly recipes: ReadonlyMap<string, readonly BlueprintMaterialNeed[]>;
    private readonly sources: ReadonlyMap<string, string>;

    constructor(options: FakeProcurementOptions = {}) {
        this.recipes = new Map(
            (options.recipes ?? []).map((recipe) => [recipe.item, recipe.ingredients]),
        );
        this.sources = new Map(Object.entries(options.sources ?? {}));
    }

    recipeFor(item: string): Result<readonly BlueprintMaterialNeed[] | null, BuildingFailure> {
        return [this.recipes.get(item) ?? null, null];
    }

    sourceFor(item: string): Result<string | null, BuildingFailure> {
        return [this.sources.get(item) ?? null, null];
    }
}

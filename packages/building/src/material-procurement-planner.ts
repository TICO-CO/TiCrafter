import type { Result, Vec3 } from '@ticrafter/core';

import type { BlueprintMaterialNeed } from './blueprint-ir.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';
import {
    type ContainerCatalogPort,
    type InventoryQueryPort,
    type MaterialPlan,
    MaterialPreflight,
    type MaterialWithdrawal,
} from './material-preflight.js';

export interface ProcurementCatalogPort {
    recipeFor(item: string): Result<readonly BlueprintMaterialNeed[] | null, BuildingFailure>;
    sourceFor(item: string): Result<string | null, BuildingFailure>;
}

export interface CraftingRequirement {
    item: string;
    count: number;
    ingredients: readonly BlueprintMaterialNeed[];
}

export interface GatheringRequirement {
    item: string;
    count: number;
    source: string;
}

export interface ProcurementPlan {
    materials: MaterialPlan;
    crafting: readonly CraftingRequirement[];
    gathering: readonly GatheringRequirement[];
    unresolved: readonly BlueprintMaterialNeed[];
    reservations: readonly MaterialWithdrawal[];
    blocked: boolean;
}

export class MaterialProcurementPlanner {
    private readonly preflight: MaterialPreflight;

    constructor(
        inventory: InventoryQueryPort,
        containers: ContainerCatalogPort,
        private readonly catalog: ProcurementCatalogPort,
    ) {
        this.preflight = new MaterialPreflight(inventory, containers);
    }

    plan(
        needs: readonly BlueprintMaterialNeed[],
        botPosition?: Vec3,
    ): Result<ProcurementPlan, BuildingFailure> {
        const [materials, materialsError] = this.preflight.check(needs, botPosition);
        if (materialsError) return [null, materialsError];
        if (materials === null) {
            return [null, BuildingFailures.worldQueryFailed('material preflight returned null')];
        }
        const crafting: CraftingRequirement[] = [];
        const gathering: GatheringRequirement[] = [];
        const unresolved: BlueprintMaterialNeed[] = [];
        for (const shortage of materials.shortages) {
            const [recipe, recipeError] = this.catalog.recipeFor(shortage.item);
            if (recipeError) return [null, recipeError];
            if (recipe !== null) {
                crafting.push({
                    item: shortage.item,
                    count: shortage.count,
                    ingredients: recipe.map((ingredient) => ({
                        item: ingredient.item,
                        count: ingredient.count * shortage.count,
                    })),
                });
                continue;
            }
            const [source, sourceError] = this.catalog.sourceFor(shortage.item);
            if (sourceError) return [null, sourceError];
            if (source !== null) {
                gathering.push({ item: shortage.item, count: shortage.count, source });
                continue;
            }
            unresolved.push(shortage);
        }
        return [
            {
                materials,
                crafting,
                gathering,
                unresolved,
                reservations: materials.withdrawals,
                blocked: unresolved.length > 0,
            },
            null,
        ];
    }
}

import {
    BuildingFailures,
    type ContainerCatalogPort,
    type ContainerView,
    MaterialProcurementPlanner,
    type ProcurementCatalogPort,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';
import type {
    SkillInventoryItem,
    SkillMaterialNeed,
    SkillProcurementAction,
    SkillProcurementPlan,
    SkillProcurementPort,
} from '@ticrafter/skills';

export interface ProcurementContainerSource {
    list(): readonly ContainerView[];
}

export class BuildingProcurementService implements SkillProcurementPort {
    constructor(
        private readonly containers: ProcurementContainerSource,
        private readonly catalog: ProcurementCatalogPort,
    ) {}

    plan(input: {
        needs: readonly SkillMaterialNeed[];
        inventory: readonly SkillInventoryItem[];
        position: Vec3;
    }): Result<SkillProcurementPlan, string> {
        const planner = new MaterialProcurementPlanner(
            {
                read: () => [
                    input.inventory.map((item) => ({ name: item.name, count: item.count })),
                    null,
                ],
            },
            this.containerPort(),
            this.catalog,
        );
        const [plan, planError] = planner.plan(
            input.needs.map((need) => ({ item: need.item, count: need.count })),
            input.position,
        );
        if (planError) return [null, BuildingFailures.describe(planError)];
        if (plan === null) return [null, 'material procurement planning returned null'];
        const actions: SkillProcurementAction[] = [
            ...plan.materials.withdrawals.map((withdrawal) => ({
                kind: 'withdraw' as const,
                container: withdrawal.position,
                item: withdrawal.item,
                count: withdrawal.count,
            })),
            ...plan.gathering.map((gather) => ({
                kind: 'gather' as const,
                item: gather.item,
                count: gather.count,
                source: gather.source,
            })),
            ...plan.smelting.map((smelt) => ({
                kind: 'smelt' as const,
                item: smelt.item,
                count: smelt.count,
                input: smelt.input,
                fuel: smelt.fuel,
            })),
            ...plan.crafting.map((craft) => ({
                kind: 'craft' as const,
                item: craft.item,
                count: craft.count,
                ingredients: craft.ingredients.map((ingredient) => ({
                    item: ingredient.item,
                    count: ingredient.count,
                })),
            })),
        ];
        return [
            {
                actions,
                shortages: plan.unresolved.map((need) => ({ item: need.item, count: need.count })),
                blocked: plan.blocked,
            },
            null,
        ];
    }

    record(input: { action: SkillProcurementAction; status: 'completed' | 'failed' }): void {
        if (input.status !== 'completed') return;
        if (input.action.kind !== 'withdraw') return;
        const container = this.containers
            .list()
            .find((candidate) =>
                BuildingProcurementService.samePosition(
                    candidate.position,
                    input.action.kind === 'withdraw' ? input.action.container : null,
                ),
            );
        if (container === undefined || container.contents === null) return;
        let remaining = input.action.count;
        const contents = container.contents
            .map((entry) => {
                if (entry.itemId !== input.action.item || remaining <= 0) return entry;
                const consumed = Math.min(entry.count, remaining);
                remaining -= consumed;
                return { ...entry, count: entry.count - consumed };
            })
            .filter((entry) => entry.count > 0);
        (container as { contents: readonly { itemId: string; count: number }[] | null }).contents =
            contents;
    }

    private containerPort(): ContainerCatalogPort {
        return {
            list: () => [[...this.containers.list()], null],
        };
    }

    private static samePosition(left: Vec3, right: Vec3 | null): boolean {
        return right !== null && left.x === right.x && left.y === right.y && left.z === right.z;
    }
}

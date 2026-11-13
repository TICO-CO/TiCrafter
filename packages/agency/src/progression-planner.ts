import type { ProgressionPlan, Result } from '@ticrafter/core';

import { ProgressionPlanModel } from './progression-plan.js';
import type {
    GoalOutcome,
    ProgressionDecision,
    ProgressionPlannerPort,
} from './progression-types.js';
import type { RecipePort } from './recipe-port.js';
import { ShelterPlan } from './shelter-plan.js';
import type { AgencySnapshot, Goal, GoalStep, ProgressionMilestone } from './types.js';

const PLANKS = 'oak_planks';
const STICKS = 'stick';
const COBBLESTONE = 'cobblestone';
const SHELTER_MATERIAL_COUNT = 32;

class InventoryView {
    private readonly counts = new Map<string, number>();

    constructor(entries: readonly { name: string; count: number }[]) {
        for (const entry of entries) this.counts.set(entry.name, entry.count);
    }

    count(item: string): number {
        return this.counts.get(item) ?? 0;
    }

    add(item: string, count: number): void {
        this.counts.set(item, this.count(item) + count);
    }

    remove(item: string, count: number): void {
        this.counts.set(item, Math.max(0, this.count(item) - count));
    }
}

export class ProgressionPlanner implements ProgressionPlannerPort {
    constructor(private readonly recipes: RecipePort) {}

    nextGoal(plan: ProgressionPlan, snapshot: AgencySnapshot): Result<ProgressionDecision, string> {
        let currentPlan = plan;
        let milestone = ProgressionPlanModel.current(currentPlan);
        while (milestone !== null && this.satisfied(milestone, snapshot)) {
            currentPlan = ProgressionPlanModel.complete(currentPlan, milestone.id, snapshot.at);
            milestone = ProgressionPlanModel.current(currentPlan);
        }
        if (milestone === null) return [{ plan: currentPlan, goal: null }, null];
        const steps = this.stepsFor(milestone, snapshot);
        if (steps.length === 0) return [{ plan: currentPlan, goal: null }, null];
        return [
            {
                plan: currentPlan,
                goal: {
                    id: `goal:progression:${milestone.id}`,
                    kind: this.goalKind(milestone),
                    label: milestone.label,
                    priority: 80,
                    source: 'routine',
                    target: this.target(milestone, snapshot),
                    steps,
                    expectedValue: 0.9,
                    estimatedCost: 0.4,
                    estimatedRisk: 0.15,
                    deadline: null,
                },
            },
            null,
        ];
    }

    observe(plan: ProgressionPlan, outcome: GoalOutcome): ProgressionPlan {
        const milestoneId = outcome.goal.id.replace('goal:progression:', '');
        const milestone = plan.milestones.find((candidate) => candidate.id === milestoneId);
        if (milestone === undefined) return plan;
        if (outcome.status === 'completed') {
            return ProgressionPlanModel.complete(plan, milestoneId, outcome.at);
        }
        return ProgressionPlanModel.recordAttempt(
            plan,
            milestoneId,
            outcome.at,
            milestone.attempts + 1 >= 2,
        );
    }

    private satisfied(milestone: ProgressionMilestone, snapshot: AgencySnapshot): boolean {
        const inventory = new InventoryView(snapshot.inventory);
        switch (milestone.id) {
            case 'forage-wood':
                return this.woodCount(inventory) >= (milestone.targetCount ?? 8);
            case 'crafting-table':
                return inventory.count('crafting_table') > 0 || snapshot.hasCraftingTable === true;
            case 'wooden-tools':
                return inventory.count('wooden_pickaxe') > 0 && inventory.count('wooden_sword') > 0;
            case 'stone-tools':
                return inventory.count('stone_pickaxe') > 0 && inventory.count('stone_sword') > 0;
            case 'furnace-chest':
                return (
                    (inventory.count('furnace') > 0 || snapshot.hasFurnace === true) &&
                    (inventory.count('chest') > 0 || snapshot.hasContainer === true)
                );
            case 'base-provisioning':
                return snapshot.isSheltered && snapshot.hasBedAtHome;
            default:
                return false;
        }
    }

    private stepsFor(
        milestone: ProgressionMilestone,
        snapshot: AgencySnapshot,
    ): readonly GoalStep[] {
        const inventory = new InventoryView(snapshot.inventory);
        switch (milestone.id) {
            case 'forage-wood':
                return this.gatherSteps('wood', milestone.targetCount ?? 8, snapshot);
            case 'crafting-table':
                return [
                    ...this.itemSteps('crafting_table', 1, inventory, snapshot),
                    this.placeStep('crafting_table', this.anchor(snapshot)),
                ];
            case 'wooden-tools':
                return [
                    ...this.itemSteps('wooden_pickaxe', 1, inventory, snapshot),
                    ...this.itemSteps('wooden_sword', 1, inventory, snapshot),
                ];
            case 'stone-tools':
                return [
                    ...this.itemSteps('stone_pickaxe', 1, inventory, snapshot),
                    ...this.itemSteps('stone_sword', 1, inventory, snapshot),
                ];
            case 'furnace-chest':
                return [
                    ...this.itemSteps('furnace', 1, inventory, snapshot),
                    ...this.itemSteps('chest', 1, inventory, snapshot),
                ];
            case 'base-provisioning':
                return [
                    ...this.itemSteps(COBBLESTONE, SHELTER_MATERIAL_COUNT, inventory, snapshot),
                    ...this.shelterSteps(snapshot),
                    ...this.itemSteps('red_bed', 1, inventory, snapshot),
                    {
                        skillId: 'place-bed',
                        label: 'Place the bed',
                        input: { target: this.bedTarget(snapshot) },
                    },
                ];
            default:
                return [];
        }
    }

    private itemSteps(
        item: string,
        count: number,
        inventory: InventoryView,
        snapshot: AgencySnapshot,
        depth = 0,
    ): GoalStep[] {
        if (inventory.count(item) >= count) return [];
        if (depth > 4) return [];
        const ingredients = this.recipes.ingredients(item);
        if (ingredients.length === 0) return this.gatherForItem(item, count, snapshot);
        const steps: GoalStep[] = [];
        for (const ingredient of ingredients) {
            steps.push(
                ...this.itemSteps(
                    ingredient.item,
                    ingredient.count,
                    inventory,
                    snapshot,
                    depth + 1,
                ),
            );
            inventory.remove(ingredient.item, ingredient.count);
        }
        inventory.add(item, count);
        return [
            ...steps,
            {
                skillId: 'craft',
                label: `Craft ${count} ${item}`,
                input: { itemName: item, count },
            },
        ];
    }

    private gatherForItem(item: string, count: number, snapshot: AgencySnapshot): GoalStep[] {
        if (item.endsWith('_log')) return this.gatherSteps('wood', count, snapshot);
        if (item === COBBLESTONE) return this.gatherSteps('stone', count, snapshot);
        if (item.endsWith('_wool')) return this.gatherSteps('wool', count, snapshot);
        return [];
    }

    private gatherSteps(
        kind: 'wood' | 'stone' | 'wool',
        count: number,
        snapshot: AgencySnapshot,
    ): GoalStep[] {
        const site = snapshot.knownResourceSites.find(
            (candidate) => candidate.kind === kind,
        )?.position;
        if (kind === 'wool') {
            return [
                {
                    skillId: 'gather-wool',
                    label: `Gather ${count} wool`,
                    input: { count },
                },
            ];
        }
        return [
            {
                skillId: 'gather-resource',
                label: `Gather ${count} ${kind}`,
                input: {
                    count,
                    blockIds: kind === 'wood' ? ['*_log'] : ['stone', 'deepslate'],
                    ...(site === undefined ? {} : { target: site }),
                },
            },
        ];
    }

    private shelterSteps(snapshot: AgencySnapshot): GoalStep[] {
        const anchor = this.anchor(snapshot);
        const blocks = ShelterPlan.shell(anchor, COBBLESTONE)
            .slice(0, SHELTER_MATERIAL_COUNT)
            .map((block) => ({
                position: block.position,
                itemName: block.itemName,
                expectedBlockId: block.itemName,
            }));
        return [
            {
                skillId: 'place-build',
                label: 'Build a small shelter',
                input: { blocks },
            },
        ];
    }

    private placeStep(item: string, anchor: { x: number; y: number; z: number }): GoalStep {
        return {
            skillId: 'place-build',
            label: `Place the ${item}`,
            input: {
                blocks: [
                    {
                        position: anchor,
                        itemName: item,
                        expectedBlockId: item,
                    },
                ],
            },
        };
    }

    private goalKind(milestone: ProgressionMilestone): Goal['kind'] {
        if (milestone.id === 'forage-wood') return 'gather';
        if (milestone.id === 'base-provisioning') return 'build-shelter';
        return 'craft';
    }

    private target(milestone: ProgressionMilestone, snapshot: AgencySnapshot) {
        if (milestone.id === 'forage-wood') {
            return (
                snapshot.knownResourceSites.find((site) => site.kind === 'wood')?.position ?? null
            );
        }
        if (milestone.id === 'stone-tools') {
            return (
                snapshot.knownResourceSites.find((site) => site.kind === 'stone')?.position ?? null
            );
        }
        if (milestone.id === 'base-provisioning' || milestone.id === 'crafting-table') {
            return snapshot.home ?? snapshot.position;
        }
        return null;
    }

    private anchor(snapshot: AgencySnapshot) {
        return snapshot.home ?? snapshot.position;
    }

    private bedTarget(snapshot: AgencySnapshot) {
        const anchor = this.anchor(snapshot);
        return { x: anchor.x, y: anchor.y, z: anchor.z + 1 };
    }

    private woodCount(inventory: InventoryView): number {
        const names = [
            'oak_log',
            'birch_log',
            'spruce_log',
            'jungle_log',
            'acacia_log',
            'dark_oak_log',
            'mangrove_log',
            'cherry_log',
            'log',
            'oak_planks',
        ];
        return names.reduce((total, name) => total + inventory.count(name), 0);
    }
}

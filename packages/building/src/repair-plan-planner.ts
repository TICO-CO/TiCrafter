import type { Result, Vec3 } from '@ticrafter/core';

import type { ConstructionPhase } from './blueprint-document.js';
import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BlueprintMaterialNeed,
} from './blueprint-ir.js';
import { ConstructionDependencyGraph } from './construction-dependency-graph.js';
import type {
    ConstructionChange,
    ConstructionDependency,
    ConstructionPlan,
} from './construction-types.js';
import { CONSTRUCTION_PHASE_ORDER } from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';
import { SchematicDiffCalculator, type WorldBlockQueryPort } from './schematic-diff.js';
import { WorkPackagePlanner } from './work-package-planner.js';

export interface RepairPlanPlanningOptions {
    maxBlocks?: number;
    planId?: string;
}

export class RepairPlanPlanner {
    constructor(private readonly options: RepairPlanPlanningOptions = {}) {}

    plan(
        blueprint: Blueprint,
        basePlan: ConstructionPlan,
        world: WorldBlockQueryPort,
    ): Result<ConstructionPlan, BuildingFailure> {
        const translated = RepairPlanPlanner.translate(blueprint, basePlan.translation);
        const [diff, diffError] = new SchematicDiffCalculator().diff(translated, world);
        if (diffError) return [null, diffError];
        if (diff === null) {
            return [null, BuildingFailures.invalidConstructionPlan('repair diff returned null')];
        }
        const phases = new Map(
            basePlan.changes.map((change) => [BlueprintIr.blockKey(change.block), change.phase]),
        );
        const placements = [...diff.missing, ...diff.mismatched].map((block) =>
            RepairPlanPlanner.placement(block, phases),
        );
        const [extras, extrasError] = this.extras(diff.extra, world);
        if (extrasError) return [null, extrasError];
        if (extras === null) {
            return [null, BuildingFailures.invalidConstructionPlan('repair extras missing')];
        }
        const changes = [...extras, ...placements];
        if (changes.length === 0) {
            return [null, BuildingFailures.invalidConstructionPlan('repair has no changes')];
        }
        const [ordering, orderError] = this.order(changes, placements);
        if (orderError) return [null, orderError];
        if (ordering === null) {
            return [
                null,
                BuildingFailures.invalidConstructionPlan('repair dependency graph returned null'),
            ];
        }
        const [order, dependencies] = ordering;
        const ranks = new Map(order.map((key, index) => [key, index]));
        const ordered = [...changes].sort(
            (left, right) =>
                (ranks.get(BlueprintIr.blockKey(left.block)) ?? Number.MAX_SAFE_INTEGER) -
                (ranks.get(BlueprintIr.blockKey(right.block)) ?? Number.MAX_SAFE_INTEGER),
        );
        const planId = this.options.planId ?? basePlan.id;
        const [workPackages, packageError] = new WorkPackagePlanner().plan(ordered, order, {
            ...(this.options.maxBlocks === undefined ? {} : { maxBlocks: this.options.maxBlocks }),
            idPrefix: planId,
        });
        if (packageError) return [null, packageError];
        if (workPackages === null) {
            return [
                null,
                BuildingFailures.invalidConstructionPlan('repair package planner returned null'),
            ];
        }
        return [
            {
                ...basePlan,
                id: planId,
                changes: ordered,
                order,
                dependencies,
                scaffolds: [],
                unreachable: [],
                phases: RepairPlanPlanner.phases(ordered),
                materials: RepairPlanPlanner.materials(ordered),
                workPackages,
            },
            null,
        ];
    }

    private extras(
        positions: readonly Vec3[],
        world: WorldBlockQueryPort,
    ): Result<ConstructionChange[] | null, BuildingFailure> {
        const changes: ConstructionChange[] = [];
        for (const position of positions) {
            const [actual, actualError] = world.blockAt(position);
            if (actualError) return [null, actualError];
            if (actual === null || BlueprintIr.isAir(actual.name)) continue;
            changes.push({
                kind: 'break',
                block: {
                    ...position,
                    state: {
                        name: actual.name,
                        ...(actual.properties === undefined
                            ? {}
                            : { properties: actual.properties }),
                    },
                    priority: 0,
                },
                phase: 'site-clear',
                reason: 'cleanup',
                dependsOn: [],
            });
        }
        return [changes, null];
    }

    private order(
        changes: readonly ConstructionChange[],
        placements: readonly ConstructionChange[],
    ): Result<[readonly string[], readonly ConstructionDependency[]] | null, BuildingFailure> {
        const [graph, graphError] = new ConstructionDependencyGraph().build(placements);
        if (graphError) return [null, graphError];
        if (graph === null) return [null, null];
        const breaks = changes
            .filter((change) => change.kind === 'break')
            .sort((left, right) => right.block.y - left.block.y);
        const breakKeys = breaks.map((change) => BlueprintIr.blockKey(change.block));
        const breakDependencies = breaks.map((change) => ({
            key: BlueprintIr.blockKey(change.block),
            phase: change.phase,
            dependsOn: [],
        }));
        return [
            [
                [...breakKeys, ...graph.order],
                [...breakDependencies, ...graph.dependencies],
            ],
            null,
        ];
    }

    private static placement(
        block: BlueprintBlock,
        phases: ReadonlyMap<string, ConstructionPhase>,
    ): ConstructionChange {
        return {
            kind: 'place',
            block,
            phase: phases.get(BlueprintIr.blockKey(block)) ?? RepairPlanPlanner.phase(block),
            reason: 'blueprint',
            dependsOn: [],
        };
    }

    private static translate(blueprint: Blueprint, translation: Vec3): Blueprint {
        return {
            ...blueprint,
            blocks: blueprint.blocks.map((block) => BlueprintIr.translate(block, translation)),
        };
    }

    private static phases(changes: readonly ConstructionChange[]): readonly ConstructionPhase[] {
        const phases = new Set(changes.map((change) => change.phase));
        return CONSTRUCTION_PHASE_ORDER.filter((phase) => phases.has(phase));
    }

    private static materials(
        changes: readonly ConstructionChange[],
    ): readonly BlueprintMaterialNeed[] {
        const counts = new Map<string, number>();
        changes
            .filter((change) => change.kind === 'place')
            .forEach((change) => {
                const item = change.block.state.name;
                counts.set(item, (counts.get(item) ?? 0) + 1);
            });
        return [...counts.entries()]
            .map(([item, count]) => ({ item, count }))
            .sort((left, right) => left.item.localeCompare(right.item));
    }

    private static phase(block: BlueprintBlock): ConstructionPhase {
        if (block.state.name.includes('ladder')) return 'access';
        switch (Math.floor(block.priority)) {
            case 0:
                return 'foundation';
            case 1:
                return 'walls';
            case 2:
                return 'roof';
            case 3:
                return 'openings';
            case 4:
                return 'interior';
            default:
                return 'decoration';
        }
    }
}

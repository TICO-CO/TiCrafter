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
    ConstructionPlan,
    ConstructionScaffold,
    SitePlan,
} from './construction-types.js';
import { CONSTRUCTION_PHASE_ORDER } from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';
import { FoundationPlanner, type FoundationPlannerOptions } from './foundation-planner.js';
import {
    ReachabilityScaffoldPlanner,
    type ReachabilityStep,
} from './reachability-scaffold-planner.js';
import type { WorldBlockQueryPort } from './schematic-diff.js';
import { WorkPackagePlanner, type WorkPackagePlanningOptions } from './work-package-planner.js';

export interface ConstructionPlanningOptions extends WorkPackagePlanningOptions {
    foundation?: FoundationPlannerOptions;
    scaffoldMaterial?: string;
}

export class ConstructionPlanPlanner {
    private readonly foundation: FoundationPlanner;

    constructor(private readonly options: ConstructionPlanningOptions = {}) {
        this.foundation = new FoundationPlanner(options.foundation);
    }

    plan(
        blueprint: Blueprint,
        site: SitePlan,
        world: WorldBlockQueryPort,
        botPosition: Vec3,
    ): Result<ConstructionPlan, BuildingFailure> {
        const blocks = blueprint.blocks.map((block) => this.translate(block, site.translation));
        const [foundation, foundationError] = this.foundation.plan(blueprint, site, world);
        if (foundationError) return [null, foundationError];
        if (foundation === null) {
            return [null, BuildingFailures.foundationFailed('foundation planner returned null')];
        }
        const blueprintChanges = blocks.map((block) => this.blueprintChange(block));
        const reserved = new Set(
            [...blueprintChanges, ...foundation.changes].map((change) =>
                BlueprintIr.blockKey(change.block),
            ),
        );
        const reachability = new ReachabilityScaffoldPlanner(world, {
            scaffoldMaterial: this.options.scaffoldMaterial ?? 'dirt',
            reservedKeys: reserved,
        });
        const [reachabilityPlan, reachabilityError] = reachability.plan(blocks, botPosition);
        if (reachabilityError) return [null, reachabilityError];
        if (reachabilityPlan === null) {
            return [null, BuildingFailures.invalidConstructionPlan('reachability returned null')];
        }
        const scaffolds = this.scaffolds(reachabilityPlan.steps);
        const scaffoldDependencies = this.scaffoldDependencies(reachabilityPlan.steps);
        const scaffoldChanges = this.scaffoldChanges(scaffolds);
        const changes = [
            ...foundation.changes,
            ...blueprintChanges.map((change) =>
                this.withScaffoldDependencies(change, scaffoldDependencies),
            ),
            ...scaffoldChanges,
        ];
        const [graph, graphError] = new ConstructionDependencyGraph().build(changes);
        if (graphError) return [null, graphError];
        if (graph === null) {
            return [
                null,
                BuildingFailures.invalidConstructionPlan('dependency graph returned null'),
            ];
        }
        const order = new Map(graph.order.map((key, index) => [key, index]));
        const ordered = [...changes].sort(
            (left, right) =>
                (order.get(BlueprintIr.blockKey(left.block)) ?? 0) -
                (order.get(BlueprintIr.blockKey(right.block)) ?? 0),
        );
        const [workPackages, packageError] = new WorkPackagePlanner().plan(
            ordered,
            graph.order,
            this.options,
        );
        if (packageError) return [null, packageError];
        if (workPackages === null) {
            return [
                null,
                BuildingFailures.invalidConstructionPlan('package planner returned null'),
            ];
        }
        return [
            {
                id: `${blueprint.id}:construction`,
                blueprintId: blueprint.id,
                anchor: site.anchor,
                rotation: site.rotation,
                translation: site.translation,
                site,
                foundation,
                changes: ordered,
                order: graph.order,
                dependencies: graph.dependencies,
                scaffolds,
                unreachable: reachabilityPlan.unreachable,
                phases: this.phases(ordered, scaffolds),
                materials: this.materials(ordered),
                workPackages,
            },
            null,
        ];
    }

    private translate(block: BlueprintBlock, translation: Vec3): BlueprintBlock {
        return {
            ...block,
            x: block.x + translation.x,
            y: block.y + translation.y,
            z: block.z + translation.z,
        };
    }

    private blueprintChange(block: BlueprintBlock): ConstructionChange {
        return {
            kind: 'place',
            block,
            phase: ConstructionPlanPlanner.phase(block),
            reason: 'blueprint',
            dependsOn: [],
        };
    }

    private scaffolds(steps: readonly ReachabilityStep[]): readonly ConstructionScaffold[] {
        const scaffolds = new Map<string, ConstructionScaffold>();
        steps.forEach((step) => {
            const targetKey = BlueprintIr.blockKey(step.block);
            step.scaffold.forEach((scaffold) => {
                const key = BlueprintIr.positionKey(scaffold.position);
                const existing = scaffolds.get(key);
                if (existing !== undefined) {
                    scaffolds.set(key, {
                        ...existing,
                        targetKeys: [...new Set([...existing.targetKeys, targetKey])],
                    });
                    return;
                }
                scaffolds.set(key, {
                    position: scaffold.position,
                    stateName: scaffold.stateName,
                    targetKeys: [targetKey],
                    removalPhase: 'scaffold-removal',
                });
            });
        });
        return [...scaffolds.values()];
    }

    private scaffoldDependencies(
        steps: readonly ReachabilityStep[],
    ): ReadonlyMap<string, readonly string[]> {
        const dependencies = new Map<string, string[]>();
        steps.forEach((step) => {
            const targetKey = BlueprintIr.blockKey(step.block);
            const keys = dependencies.get(targetKey) ?? [];
            step.scaffold.forEach((scaffold) => {
                const key = BlueprintIr.positionKey(scaffold.position);
                if (!keys.includes(key)) keys.push(key);
            });
            dependencies.set(targetKey, keys);
        });
        return dependencies;
    }

    private scaffoldChanges(scaffolds: readonly ConstructionScaffold[]): ConstructionChange[] {
        return scaffolds.map((scaffold) => ({
            kind: 'place',
            block: {
                ...scaffold.position,
                state: { name: scaffold.stateName },
                priority: 0,
            },
            phase: 'scaffold',
            reason: 'scaffold',
            dependsOn: [],
        }));
    }

    private withScaffoldDependencies(
        change: ConstructionChange,
        dependencies: ReadonlyMap<string, readonly string[]>,
    ): ConstructionChange {
        const key = BlueprintIr.blockKey(change.block);
        const scaffoldKeys = dependencies.get(key) ?? [];
        if (scaffoldKeys.length === 0) return change;
        return { ...change, dependsOn: [...change.dependsOn, ...scaffoldKeys] };
    }

    private phases(
        changes: readonly ConstructionChange[],
        scaffolds: readonly ConstructionScaffold[],
    ): readonly ConstructionPhase[] {
        const phases = new Set(changes.map((change) => change.phase));
        if (scaffolds.length > 0) phases.add('scaffold-removal');
        return CONSTRUCTION_PHASE_ORDER.filter((phase) => phases.has(phase));
    }

    private materials(changes: readonly ConstructionChange[]): readonly BlueprintMaterialNeed[] {
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

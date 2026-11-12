import type { Result, Vec3 } from '@ticrafter/core';

import type { ConstructionPhase } from './blueprint-document.js';
import {
    type BlueprintBlockState,
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
import type { WorldBlockState } from './schematic-diff.js';
import { WorkPackagePlanner } from './work-package-planner.js';

export interface RollbackPlanRecord {
    position: Vec3;
    before: WorldBlockState | null;
    after: WorldBlockState;
}

export interface RollbackPlanPlanningOptions {
    maxBlocks?: number;
    planId?: string;
}

interface PositionRollback {
    position: Vec3;
    before: WorldBlockState | null;
    after: WorldBlockState;
}

export class RollbackPlanPlanner {
    constructor(private readonly options: RollbackPlanPlanningOptions = {}) {}

    plan(
        basePlan: ConstructionPlan,
        records: readonly RollbackPlanRecord[],
    ): Result<ConstructionPlan, BuildingFailure> {
        const positions = this.positions(records);
        const changes = this.changes(positions, basePlan);
        if (changes.length === 0) {
            return [null, BuildingFailures.invalidConstructionPlan('rollback has no changes')];
        }
        const breaks = changes
            .filter((change) => change.kind === 'break')
            .sort((left, right) => right.block.y - left.block.y);
        const placements = changes.filter((change) => change.kind === 'place');
        const [graph, graphError] = new ConstructionDependencyGraph().build(placements);
        if (graphError) return [null, graphError];
        if (graph === null) {
            return [
                null,
                BuildingFailures.invalidConstructionPlan('rollback dependency graph returned null'),
            ];
        }
        const breakKeys = breaks.map((change) => BlueprintIr.blockKey(change.block));
        const order = [...breakKeys, ...graph.order];
        const dependencies: readonly ConstructionDependency[] = [
            ...breaks.map((change) => ({
                key: BlueprintIr.blockKey(change.block),
                phase: change.phase,
                dependsOn: [],
            })),
            ...graph.dependencies,
        ];
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
                BuildingFailures.invalidConstructionPlan('rollback package planner returned null'),
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
                phases: RollbackPlanPlanner.phases(ordered),
                materials: RollbackPlanPlanner.materials(ordered),
                workPackages,
            },
            null,
        ];
    }

    private positions(records: readonly RollbackPlanRecord[]): readonly PositionRollback[] {
        const byPosition = new Map<string, PositionRollback>();
        records.forEach((record) => {
            const key = BlueprintIr.positionKey(record.position);
            const existing = byPosition.get(key);
            if (existing === undefined) {
                byPosition.set(key, {
                    position: record.position,
                    before: record.before,
                    after: record.after,
                });
                return;
            }
            byPosition.set(key, { ...existing, after: record.after });
        });
        return [...byPosition.values()].reverse();
    }

    private changes(
        positions: readonly PositionRollback[],
        basePlan: ConstructionPlan,
    ): ConstructionChange[] {
        const phases = new Map(
            basePlan.changes.map((change) => [BlueprintIr.blockKey(change.block), change.phase]),
        );
        return positions.flatMap((entry) => {
            const key = BlueprintIr.positionKey(entry.position);
            const original = entry.before;
            if (original !== null && RollbackPlanPlanner.same(original, entry.after)) return [];
            const breaks =
                BlueprintIr.isAir(entry.after.name) || original?.name === entry.after.name
                    ? []
                    : [
                          RollbackPlanPlanner.change(
                              'break',
                              entry.position,
                              entry.after,
                              'site-clear',
                          ),
                      ];
            if (original === null || BlueprintIr.isAir(original.name)) return breaks;
            const phase = phases.get(key) ?? 'foundation';
            return [
                ...breaks,
                RollbackPlanPlanner.change('place', entry.position, original, phase),
            ];
        });
    }

    private static change(
        kind: 'place' | 'break',
        position: Vec3,
        state: WorldBlockState,
        phase: ConstructionPhase,
    ): ConstructionChange {
        return {
            kind,
            block: {
                ...position,
                state: {
                    name: state.name,
                    ...(state.properties === undefined ? {} : { properties: state.properties }),
                },
                priority: 0,
            },
            phase,
            reason: kind === 'break' ? 'cleanup' : 'blueprint',
            dependsOn: [],
        };
    }

    private static same(left: BlueprintBlockState, right: WorldBlockState): boolean {
        if (left.name !== right.name) return false;
        const leftProperties = left.properties ?? {};
        const rightProperties = right.properties ?? {};
        const leftKeys = Object.keys(leftProperties);
        if (leftKeys.length !== Object.keys(rightProperties).length) return false;
        return leftKeys.every((key) => leftProperties[key] === rightProperties[key]);
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
}

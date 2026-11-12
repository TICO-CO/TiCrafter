import type { Result } from '@ticrafter/core';

import type { ConstructionPhase } from './blueprint-document.js';
import type {
    BlueprintBoundingBox,
    BlueprintMaterialNeed,
    WorkPackageStrategy,
} from './blueprint-ir.js';
import { BlueprintIr } from './blueprint-ir.js';
import {
    CONSTRUCTION_PHASE_ORDER,
    type ConstructionChange,
    type PlannedWorkPackage,
} from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';

export interface WorkPackagePlanningOptions {
    maxBlocks?: number;
    strategy?: WorkPackageStrategy;
}

interface MutablePackage {
    phase: ConstructionPhase;
    changes: ConstructionChange[];
}

export class WorkPackagePlanner {
    plan(
        changes: readonly ConstructionChange[],
        order: readonly string[],
        options: WorkPackagePlanningOptions = {},
    ): Result<readonly PlannedWorkPackage[], BuildingFailure> {
        if (changes.length === 0) {
            return [null, BuildingFailures.invalidConstructionPlan('no changes to package')];
        }
        const sorted = this.sort(changes, order);
        const packages = this.group(sorted, options.maxBlocks ?? Number.POSITIVE_INFINITY);
        const merged = this.merge(packages, changes);
        const dependencies = new Map(
            changes.map((change) => [BlueprintIr.blockKey(change.block), change.dependsOn]),
        );
        return [this.finalize(merged, options.strategy ?? 'layers', dependencies), null];
    }

    private sort(
        changes: readonly ConstructionChange[],
        order: readonly string[],
    ): readonly ConstructionChange[] {
        const ranks = new Map(order.map((key, index) => [key, index]));
        return [...changes].sort((left, right) => {
            const leftRank = ranks.get(BlueprintIr.blockKey(left.block)) ?? Number.MAX_SAFE_INTEGER;
            const rightRank =
                ranks.get(BlueprintIr.blockKey(right.block)) ?? Number.MAX_SAFE_INTEGER;
            if (leftRank !== rightRank) return leftRank - rightRank;
            return left.block.y - right.block.y;
        });
    }

    private group(
        changes: readonly ConstructionChange[],
        maximum: number,
    ): readonly MutablePackage[] {
        const groups = new Map<ConstructionPhase, ConstructionChange[]>();
        changes.forEach((change) => {
            const group = groups.get(change.phase) ?? [];
            group.push(change);
            groups.set(change.phase, group);
        });
        const packages: MutablePackage[] = [];
        for (const phase of CONSTRUCTION_PHASE_ORDER) {
            const group = groups.get(phase);
            if (group === undefined) continue;
            const size =
                Number.isFinite(maximum) && maximum > 0 ? Math.floor(maximum) : group.length;
            for (let index = 0; index < group.length; index += size) {
                packages.push({ phase, changes: group.slice(index, index + size) });
            }
        }
        return packages;
    }

    private merge(
        initial: readonly MutablePackage[],
        changes: readonly ConstructionChange[],
    ): readonly MutablePackage[] {
        const dependencies = new Map(
            changes.map((change) => [BlueprintIr.blockKey(change.block), change.dependsOn]),
        );
        const byKey = new Map(
            changes.map((change) => [BlueprintIr.blockKey(change.block), change]),
        );
        let packages: readonly MutablePackage[] = initial.map((entry) => ({
            ...entry,
            changes: [...entry.changes],
        }));
        let merged = true;
        while (merged) {
            merged = false;
            const owner = this.owners(packages);
            for (const entry of packages) {
                const candidate = entry.changes
                    .flatMap((change) =>
                        (dependencies.get(BlueprintIr.blockKey(change.block)) ?? []).flatMap(
                            (key) => {
                                const dependencyChange = byKey.get(key);
                                const other = owner.get(key);
                                if (dependencyChange === undefined) return [];
                                if (other === undefined || other === entry) return [];
                                if (!this.atomic(change, dependencyChange)) return [];
                                return [other];
                            },
                        ),
                    )
                    .find((other) => other !== entry);
                if (candidate === undefined) continue;
                packages = this.combine(packages, entry, candidate);
                merged = true;
                break;
            }
        }
        return packages;
    }

    private atomic(left: ConstructionChange, right: ConstructionChange): boolean {
        if (right.reason === 'scaffold') return left.reason === 'blueprint';
        if (left.block.state.name.endsWith('_door') && right.block.state.name.endsWith('_door')) {
            return left.block.x === right.block.x && left.block.z === right.block.z;
        }
        if (left.block.state.name.endsWith('_bed') && right.block.state.name.endsWith('_bed')) {
            return true;
        }
        return false;
    }

    private combine(
        packages: readonly MutablePackage[],
        left: MutablePackage,
        right: MutablePackage,
    ): readonly MutablePackage[] {
        const combined = { phase: left.phase, changes: [...left.changes, ...right.changes] };
        return packages.filter((entry) => entry !== left && entry !== right).concat(combined);
    }

    private owners(packages: readonly MutablePackage[]): ReadonlyMap<string, MutablePackage> {
        return new Map(
            packages.flatMap((entry) =>
                entry.changes.map((change) => [BlueprintIr.blockKey(change.block), entry] as const),
            ),
        );
    }

    private finalize(
        packages: readonly MutablePackage[],
        strategy: WorkPackageStrategy,
        dependencies: ReadonlyMap<string, readonly string[]>,
    ): readonly PlannedWorkPackage[] {
        const planned: PlannedWorkPackage[] = packages.map((entry, index) => {
            const keys = entry.changes.map((change) => BlueprintIr.blockKey(change.block));
            const materials = new Map<string, number>();
            entry.changes
                .filter((change) => change.kind === 'place')
                .forEach((change) => {
                    const item = change.block.state.name;
                    materials.set(item, (materials.get(item) ?? 0) + 1);
                });
            return {
                id: `${strategy}:${entry.phase}:${index}`,
                bbox: WorkPackagePlanner.bounds(entry.changes),
                blockKeys: keys,
                strategy,
                status: 'planned',
                phase: entry.phase,
                materials: [...materials.entries()]
                    .map(([item, count]) => ({ item, count }))
                    .sort((left, right) => left.item.localeCompare(right.item)),
                scaffoldPositions: entry.changes
                    .filter((change) => change.reason === 'scaffold')
                    .map((change) => BlueprintIr.position(change.block)),
                predecessorIds: [],
            };
        });
        const owners = new Map(
            planned.flatMap((entry) => entry.blockKeys.map((key) => [key, entry.id] as const)),
        );
        return planned.map((entry) => {
            const predecessors = new Set<string>();
            entry.blockKeys.forEach((key) => {
                (dependencies.get(key) ?? []).forEach((dependency) => {
                    const owner = owners.get(dependency);
                    if (owner !== undefined && owner !== entry.id) predecessors.add(owner);
                });
            });
            return { ...entry, predecessorIds: [...predecessors].sort() };
        });
    }

    private static bounds(changes: readonly ConstructionChange[]): BlueprintBoundingBox {
        const positions = changes.map((change) => change.block);
        const first = positions[0] ?? { x: 0, y: 0, z: 0 };
        return positions.reduce<BlueprintBoundingBox>(
            (bounds, block) => ({
                min: {
                    x: Math.min(bounds.min.x, block.x),
                    y: Math.min(bounds.min.y, block.y),
                    z: Math.min(bounds.min.z, block.z),
                },
                max: {
                    x: Math.max(bounds.max.x, block.x),
                    y: Math.max(bounds.max.y, block.y),
                    z: Math.max(bounds.max.z, block.z),
                },
            }),
            {
                min: { x: first.x, y: first.y, z: first.z },
                max: { x: first.x, y: first.y, z: first.z },
            },
        );
    }
}

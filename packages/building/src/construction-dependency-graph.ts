import type { Result, Vec3 } from '@ticrafter/core';

import type { BlueprintBlock } from './blueprint-ir.js';
import {
    CONSTRUCTION_PHASE_ORDER,
    type ConstructionChange,
    type ConstructionDependency,
    type ConstructionGraph,
} from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';

const ATTACHABLE_BLOCKS: ReadonlySet<string> = new Set([
    'torch',
    'wall_torch',
    'soul_torch',
    'soul_wall_torch',
    'ladder',
    'lever',
    'button',
    'stone_button',
    'sign',
    'wall_sign',
    'hanging_sign',
    'wall_hanging_sign',
    'tripwire_hook',
    'lantern',
    'vine',
    'bell',
    'candle',
    'chain',
    'painting',
    'item_frame',
]);

export class ConstructionDependencyGraph {
    build(changes: readonly ConstructionChange[]): Result<ConstructionGraph, BuildingFailure> {
        const byKey = new Map<string, ConstructionChange>();
        for (const change of changes) {
            const key = ConstructionDependencyGraph.key(change.block);
            if (byKey.has(key)) {
                return [
                    null,
                    BuildingFailures.invalidConstructionPlan(`duplicate change at ${key}`),
                ];
            }
            byKey.set(key, change);
        }
        const dependencies = new Map<string, readonly string[]>();
        for (const [key, change] of byKey) {
            dependencies.set(key, this.dependencies(change, byKey));
        }
        return this.order(byKey, dependencies);
    }

    private dependencies(
        change: ConstructionChange,
        byKey: ReadonlyMap<string, ConstructionChange>,
    ): readonly string[] {
        const dependencies = new Set(
            change.dependsOn.filter((dependency) => byKey.has(dependency)),
        );
        if (change.kind !== 'place') return [...dependencies];
        const support = this.support(change.block, byKey);
        if (support !== null) dependencies.add(ConstructionDependencyGraph.key(support));
        const side = this.sideSupport(change.block, byKey);
        if (side !== null) dependencies.add(ConstructionDependencyGraph.key(side));
        const multiBlock = this.multiBlockSupport(change.block, byKey);
        if (multiBlock !== null) dependencies.add(ConstructionDependencyGraph.key(multiBlock));
        return [...dependencies];
    }

    private support(
        block: BlueprintBlock,
        byKey: ReadonlyMap<string, ConstructionChange>,
    ): BlueprintBlock | null {
        const support = byKey.get(`${block.x},${block.y - 1},${block.z}`);
        return support?.block ?? null;
    }

    private multiBlockSupport(
        block: BlueprintBlock,
        byKey: ReadonlyMap<string, ConstructionChange>,
    ): BlueprintBlock | null {
        if (block.state.name.endsWith('_door') && block.state.properties?.half === 'upper') {
            const lower = byKey.get(`${block.x},${block.y - 1},${block.z}`);
            return lower?.block ?? null;
        }
        if (block.state.name.endsWith('_bed') && block.state.properties?.part === 'head') {
            const facing = block.state.properties.facing;
            const offset =
                facing === undefined
                    ? { x: 0, z: -1 }
                    : ConstructionDependencyGraph.facingOffset(facing);
            const foot = byKey.get(`${block.x + offset.x},${block.y},${block.z + offset.z}`);
            return foot?.block ?? null;
        }
        return null;
    }

    private sideSupport(
        block: BlueprintBlock,
        byKey: ReadonlyMap<string, ConstructionChange>,
    ): BlueprintBlock | null {
        if (!ATTACHABLE_BLOCKS.has(block.state.name)) return null;
        const facing = block.state.properties?.facing;
        const offsets =
            facing === undefined
                ? [
                      { x: 0, z: 1 },
                      { x: 0, z: -1 },
                      { x: 1, z: 0 },
                      { x: -1, z: 0 },
                  ]
                : [ConstructionDependencyGraph.facingOffset(facing)];
        for (const offset of offsets) {
            const support = byKey.get(`${block.x + offset.x},${block.y},${block.z + offset.z}`);
            if (support === undefined) continue;
            if (ATTACHABLE_BLOCKS.has(support.block.state.name)) continue;
            return support.block;
        }
        return null;
    }

    private order(
        byKey: ReadonlyMap<string, ConstructionChange>,
        dependencies: ReadonlyMap<string, readonly string[]>,
    ): Result<ConstructionGraph, BuildingFailure> {
        const remaining = new Map(byKey);
        const order: string[] = [];
        while (remaining.size > 0) {
            const ready = [...remaining.entries()]
                .filter(([, change]) => {
                    const needed = dependencies.get(ConstructionDependencyGraph.key(change.block));
                    return (needed ?? []).every((dependency) => !remaining.has(dependency));
                })
                .sort(([, left], [, right]) => this.compare(left, right));
            const next = ready[0];
            if (next === undefined) {
                return [null, BuildingFailures.invalidConstructionPlan('change dependency cycle')];
            }
            order.push(next[0]);
            remaining.delete(next[0]);
        }
        return [
            {
                dependencies: order.map((key) => {
                    const change = byKey.get(key);
                    return {
                        key,
                        phase: change?.phase ?? 'cleanup',
                        dependsOn: dependencies.get(key) ?? [],
                    };
                }),
                order,
            },
            null,
        ];
    }

    private compare(left: ConstructionChange, right: ConstructionChange): number {
        const leftPhase = CONSTRUCTION_PHASE_ORDER.indexOf(left.phase);
        const rightPhase = CONSTRUCTION_PHASE_ORDER.indexOf(right.phase);
        if (leftPhase !== rightPhase) return leftPhase - rightPhase;
        if (left.block.y !== right.block.y) return left.block.y - right.block.y;
        if (left.block.priority !== right.block.priority) {
            return left.block.priority - right.block.priority;
        }
        if (left.block.x !== right.block.x) return left.block.x - right.block.x;
        return left.block.z - right.block.z;
    }

    private static key(block: BlueprintBlock): string {
        return `${block.x},${block.y},${block.z}`;
    }

    private static facingOffset(facing: string): Vec3 {
        switch (facing) {
            case 'north':
                return { x: 0, y: 0, z: 1 };
            case 'south':
                return { x: 0, y: 0, z: -1 };
            case 'east':
                return { x: -1, y: 0, z: 0 };
            case 'west':
                return { x: 1, y: 0, z: 0 };
            default:
                return { x: 0, y: 0, z: 0 };
        }
    }
}

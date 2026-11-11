import type { Result } from '@ticrafter/core';

import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BlueprintWorkPackage,
} from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export interface OrderedBlock {
    block: BlueprintBlock;
    supports: readonly string[];
}

export class BuildOrderPlanner {
    plan(
        blueprint: Blueprint,
        packages?: readonly BlueprintWorkPackage[],
    ): Result<readonly OrderedBlock[], BuildingFailure> {
        const selected = this.selectBlocks(blueprint.blocks, packages);
        const byKey = new Map(selected.map((block) => [BlueprintIr.blockKey(block), block]));
        const dependencies = new Map<string, readonly string[]>();
        selected.forEach((block) => {
            const supportKey = this.supportKey(block);
            const supports = byKey.has(supportKey) ? [supportKey] : [];
            dependencies.set(BlueprintIr.blockKey(block), supports);
        });
        return this.topologicalOrder(selected, dependencies);
    }

    private selectBlocks(
        blocks: readonly BlueprintBlock[],
        packages?: readonly BlueprintWorkPackage[],
    ): readonly BlueprintBlock[] {
        if (packages === undefined || packages.length === 0) return blocks;
        const keys = new Set(packages.flatMap((workPackage) => workPackage.blockKeys));
        return blocks.filter((block) => keys.has(BlueprintIr.blockKey(block)));
    }

    private topologicalOrder(
        blocks: readonly BlueprintBlock[],
        dependencies: ReadonlyMap<string, readonly string[]>,
    ): Result<readonly OrderedBlock[], BuildingFailure> {
        const remaining = new Map(
            blocks.map((block) => [BlueprintIr.blockKey(block), block] as const),
        );
        const ordered: OrderedBlock[] = [];
        while (remaining.size > 0) {
            const ready = [...remaining.values()]
                .filter((block) => {
                    const supports = dependencies.get(BlueprintIr.blockKey(block)) ?? [];
                    return supports.every((support) => !remaining.has(support));
                })
                .sort((left, right) => this.compare(left, right));
            const next = ready[0];
            if (next === undefined) {
                return [
                    null,
                    {
                        type: 'INVALID_BLUEPRINT',
                        message: 'blueprint contains a support-cycle',
                    },
                ];
            }
            const key = BlueprintIr.blockKey(next);
            ordered.push({ block: next, supports: dependencies.get(key) ?? [] });
            remaining.delete(key);
        }
        return [ordered, null];
    }

    private supportKey(block: BlueprintBlock): string {
        return `${block.x},${block.y - 1},${block.z}`;
    }

    private compare(left: BlueprintBlock, right: BlueprintBlock): number {
        if (left.y !== right.y) return left.y - right.y;
        if (left.priority !== right.priority) return left.priority - right.priority;
        if (left.x !== right.x) return left.x - right.x;
        return left.z - right.z;
    }
}

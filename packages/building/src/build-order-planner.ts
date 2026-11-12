import type { Result } from '@ticrafter/core';

import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BlueprintWorkPackage,
} from './blueprint-ir.js';
import { ConstructionDependencyGraph } from './construction-dependency-graph.js';
import type { ConstructionChange } from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';

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
        const changes = selected.map<ConstructionChange>((block) => ({
            kind: 'place',
            block,
            phase: 'walls',
            reason: 'blueprint',
            dependsOn: [],
        }));
        const [graph, graphError] = new ConstructionDependencyGraph().build(changes);
        if (graphError) return [null, graphError];
        if (graph === null) {
            return [null, BuildingFailures.invalidBlueprint('dependency graph returned null')];
        }
        const blocks = new Map(selected.map((block) => [BlueprintIr.blockKey(block), block]));
        const ordered: OrderedBlock[] = [];
        for (const key of graph.order) {
            const block = blocks.get(key);
            if (block === undefined) continue;
            const dependency = graph.dependencies.find((entry) => entry.key === key);
            ordered.push({ block, supports: dependency?.dependsOn ?? [] });
        }
        return [ordered, null];
    }

    private selectBlocks(
        blocks: readonly BlueprintBlock[],
        packages?: readonly BlueprintWorkPackage[],
    ): readonly BlueprintBlock[] {
        if (packages === undefined || packages.length === 0) return blocks;
        const keys = new Set(packages.flatMap((workPackage) => workPackage.blockKeys));
        return blocks.filter((block) => keys.has(BlueprintIr.blockKey(block)));
    }
}

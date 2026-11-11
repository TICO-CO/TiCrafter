import type { Result } from '@ticrafter/core';

import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BlueprintWorkPackage,
    type WorkPackageStrategy,
} from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export interface PartitionOptions {
    strategy?: WorkPackageStrategy;
    maxBlocks?: number;
}

export class WorkPackagePartitioner {
    partition(
        blueprint: Blueprint,
        options: PartitionOptions = {},
    ): Result<readonly BlueprintWorkPackage[], BuildingFailure> {
        const strategy = options.strategy ?? 'layers';
        const groups = this.group(blueprint.blocks, strategy);
        const maximum = options.maxBlocks ?? Number.POSITIVE_INFINITY;
        const packages: BlueprintWorkPackage[] = [];
        groups.forEach((group) => {
            const chunks = this.chunk(this.sortBlocks(group), maximum);
            chunks.forEach((chunk) => {
                const [bounds, boundsError] = BlueprintIr.boundingBox(chunk);
                if (boundsError) return;
                if (bounds === null) return;
                packages.push({
                    id: `${blueprint.id}:${strategy}:${packages.length}`,
                    bbox: bounds,
                    blockKeys: chunk.map((block) => BlueprintIr.blockKey(block)),
                    strategy,
                    status: 'planned',
                });
            });
        });
        if (packages.length === 0) {
            return [null, { type: 'INVALID_PACKAGE', message: 'blueprint produced no packages' }];
        }
        return [packages, null];
    }

    private group(
        blocks: readonly BlueprintBlock[],
        strategy: WorkPackageStrategy,
    ): readonly (readonly BlueprintBlock[])[] {
        switch (strategy) {
            case 'single':
                return [blocks];
            case 'layers':
                return this.groupBy(blocks, (block) => String(block.y));
            case 'slices':
                return this.groupBy(blocks, (block) => String(block.x));
            case 'quadrants':
                return this.groupBy(blocks, (block) => this.quadrant(block, blocks));
        }
    }

    private groupBy(
        blocks: readonly BlueprintBlock[],
        keyFor: (block: BlueprintBlock) => string,
    ): readonly (readonly BlueprintBlock[])[] {
        const groups = new Map<string, BlueprintBlock[]>();
        blocks.forEach((block) => {
            const key = keyFor(block);
            const group = groups.get(key) ?? [];
            group.push(block);
            groups.set(key, group);
        });
        return [...groups.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([, group]) => group);
    }

    private quadrant(block: BlueprintBlock, blocks: readonly BlueprintBlock[]): string {
        const [bounds, boundsError] = BlueprintIr.boundingBox(blocks);
        if (boundsError || bounds === null) return '0:0';
        const centerX = Math.floor((bounds.min.x + bounds.max.x) / 2);
        const centerZ = Math.floor((bounds.min.z + bounds.max.z) / 2);
        return `${block.x <= centerX ? 0 : 1}:${block.z <= centerZ ? 0 : 1}`;
    }

    private sortBlocks(blocks: readonly BlueprintBlock[]): BlueprintBlock[] {
        return [...blocks].sort((left, right) => {
            if (left.y !== right.y) return left.y - right.y;
            if (left.priority !== right.priority) return left.priority - right.priority;
            if (left.x !== right.x) return left.x - right.x;
            return left.z - right.z;
        });
    }

    private chunk(
        blocks: readonly BlueprintBlock[],
        maximum: number,
    ): readonly (readonly BlueprintBlock[])[] {
        if (!Number.isFinite(maximum) || maximum <= 0) return [blocks];
        const size = Math.max(1, Math.floor(maximum));
        const chunks: BlueprintBlock[][] = [];
        for (let index = 0; index < blocks.length; index += size) {
            chunks.push(blocks.slice(index, index + size));
        }
        return chunks;
    }
}

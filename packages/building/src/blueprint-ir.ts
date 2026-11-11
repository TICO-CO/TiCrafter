import type { Result, Vec3 } from '@ticrafter/core';

import type { BuildingFailure } from './failures.js';

export type BlueprintRotation = 0 | 90 | 180 | 270;

export interface BlueprintBlockState {
    name: string;
    properties?: Readonly<Record<string, string>>;
}

export interface BlueprintBlock {
    x: number;
    y: number;
    z: number;
    state: BlueprintBlockState;
    priority: number;
}

export interface BlueprintMaterialNeed {
    item: string;
    count: number;
}

export interface BlueprintBoundingBox {
    min: Vec3;
    max: Vec3;
}

export type BlueprintConstraint =
    | { kind: 'protected'; bbox: BlueprintBoundingBox }
    | { kind: 'no-build'; polygon: readonly Vec3[] }
    | { kind: 'support'; position: Vec3 };

export interface BlueprintWorkPackage {
    id: string;
    bbox: BlueprintBoundingBox;
    blockKeys: readonly string[];
    strategy: WorkPackageStrategy;
    status: 'planned' | 'claimed' | 'building' | 'complete';
}

export type WorkPackageStrategy = 'single' | 'layers' | 'slices' | 'quadrants';

export interface Blueprint {
    id: string;
    anchor: Vec3;
    rotation: BlueprintRotation;
    blocks: readonly BlueprintBlock[];
    materials: readonly BlueprintMaterialNeed[];
    constraints: readonly BlueprintConstraint[];
    workPackages?: readonly BlueprintWorkPackage[];
}

export interface BlueprintDraft {
    blocks: readonly BlueprintBlock[];
    materials: readonly BlueprintMaterialNeed[];
    constraints: readonly BlueprintConstraint[];
}

const AIR_BLOCK_IDS: ReadonlySet<string> = new Set(['air', 'cave_air', 'void_air']);
const VALID_ROTATIONS: ReadonlySet<number> = new Set([0, 90, 180, 270]);

export class BlueprintIr {
    static position(block: BlueprintBlock): Vec3 {
        return { x: block.x, y: block.y, z: block.z };
    }

    static positionKey(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }

    static blockKey(block: BlueprintBlock): string {
        return BlueprintIr.positionKey(BlueprintIr.position(block));
    }

    static isAir(stateName: string): boolean {
        return AIR_BLOCK_IDS.has(stateName);
    }

    static isRotation(value: number): value is BlueprintRotation {
        return VALID_ROTATIONS.has(value);
    }

    static boundingBox(
        blocks: readonly BlueprintBlock[],
    ): Result<BlueprintBoundingBox, BuildingFailure> {
        if (blocks.length === 0) {
            return [null, { type: 'INVALID_BLUEPRINT', message: 'blueprint has no blocks' }];
        }
        const first = blocks[0];
        if (first === undefined) {
            return [null, { type: 'INVALID_BLUEPRINT', message: 'blueprint has no blocks' }];
        }
        const bounds = blocks.reduce<BlueprintBoundingBox>(
            (current, block) => ({
                min: {
                    x: Math.min(current.min.x, block.x),
                    y: Math.min(current.min.y, block.y),
                    z: Math.min(current.min.z, block.z),
                },
                max: {
                    x: Math.max(current.max.x, block.x),
                    y: Math.max(current.max.y, block.y),
                    z: Math.max(current.max.z, block.z),
                },
            }),
            {
                min: { x: first.x, y: first.y, z: first.z },
                max: { x: first.x, y: first.y, z: first.z },
            },
        );
        return [bounds, null];
    }

    static materialNeeds(blocks: readonly BlueprintBlock[]): BlueprintMaterialNeed[] {
        const counts = new Map<string, number>();
        blocks
            .filter((block) => !BlueprintIr.isAir(block.state.name))
            .forEach((block) => {
                counts.set(block.state.name, (counts.get(block.state.name) ?? 0) + 1);
            });
        return [...counts.entries()]
            .map(([item, count]) => ({ item, count }))
            .sort((left, right) => left.item.localeCompare(right.item));
    }

    static translate(block: BlueprintBlock, anchor: Vec3): BlueprintBlock {
        return {
            ...block,
            x: block.x + anchor.x,
            y: block.y + anchor.y,
            z: block.z + anchor.z,
        };
    }

    static rotate(block: BlueprintBlock, rotation: BlueprintRotation): BlueprintBlock {
        switch (rotation) {
            case 0:
                return block;
            case 90:
                return { ...block, x: -block.z, z: block.x };
            case 180:
                return { ...block, x: -block.x, z: -block.z };
            case 270:
                return { ...block, x: block.z, z: -block.x };
        }
    }

    static transform(
        block: BlueprintBlock,
        anchor: Vec3,
        rotation: BlueprintRotation,
    ): BlueprintBlock {
        return BlueprintIr.translate(BlueprintIr.rotate(block, rotation), anchor);
    }

    static contains(bounds: BlueprintBoundingBox, position: Vec3): boolean {
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
        );
    }

    static intersects(left: BlueprintBoundingBox, right: BlueprintBoundingBox): boolean {
        return (
            left.min.x <= right.max.x &&
            left.max.x >= right.min.x &&
            left.min.y <= right.max.y &&
            left.max.y >= right.min.y &&
            left.min.z <= right.max.z &&
            left.max.z >= right.min.z
        );
    }
}

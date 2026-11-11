import type { Result, Vec3 } from '@ticrafter/core';

import {
    type Blueprint,
    type BlueprintBlock,
    type BlueprintBoundingBox,
    BlueprintIr,
    type BlueprintMaterialNeed,
} from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export interface BlueprintRulesView {
    protectedBboxes?: readonly BlueprintBoundingBox[];
    noBuildZones?: readonly (readonly Vec3[])[];
}

export class BlueprintValidator {
    static validate(
        blueprint: Blueprint,
        rules: BlueprintRulesView = {},
    ): Result<Blueprint, BuildingFailure> {
        const identityError = BlueprintValidator.validateIdentity(blueprint);
        if (identityError) return [null, identityError];

        const blockError = BlueprintValidator.validateBlocks(blueprint.blocks);
        if (blockError) return [null, blockError];

        const materialError = BlueprintValidator.validateMaterials(
            blueprint.blocks,
            blueprint.materials,
        );
        if (materialError) return [null, materialError];

        const constraintError = BlueprintValidator.validateConstraints(blueprint);
        if (constraintError) return [null, constraintError];

        const regionError = BlueprintValidator.validateRegions(blueprint.blocks, rules);
        if (regionError) return [null, regionError];

        return [blueprint, null];
    }

    private static validateIdentity(blueprint: Blueprint): BuildingFailure | null {
        if (blueprint.id.trim().length === 0) {
            return { type: 'INVALID_BLUEPRINT', message: 'blueprint id is empty' };
        }
        if (!BlueprintIr.isRotation(blueprint.rotation)) {
            return { type: 'INVALID_ROTATION', value: blueprint.rotation };
        }
        if (!BlueprintValidator.isPosition(blueprint.anchor)) {
            return { type: 'INVALID_BLUEPRINT', message: 'blueprint anchor must be integer' };
        }
        return null;
    }

    private static validateBlocks(blocks: readonly BlueprintBlock[]): BuildingFailure | null {
        if (blocks.length === 0) {
            return { type: 'INVALID_BLUEPRINT', message: 'blueprint has no blocks' };
        }
        const positions = new Set<string>();
        for (const block of blocks) {
            if (!BlueprintValidator.isIntegerPosition(block)) {
                return {
                    type: 'INVALID_BLOCK',
                    message: 'block position must use integer coordinates',
                };
            }
            if (block.state.name.trim().length === 0) {
                return { type: 'INVALID_BLOCK', message: 'block state name is empty' };
            }
            if (!Number.isFinite(block.priority) || block.priority < 0) {
                return { type: 'INVALID_BLOCK', message: 'block priority must be non-negative' };
            }
            const key = BlueprintIr.blockKey(block);
            if (positions.has(key)) {
                return {
                    type: 'DUPLICATE_POSITION',
                    position: { x: block.x, y: block.y, z: block.z },
                };
            }
            positions.add(key);
        }
        return null;
    }

    private static validateMaterials(
        blocks: readonly BlueprintBlock[],
        materials: readonly BlueprintMaterialNeed[],
    ): BuildingFailure | null {
        const items = new Set<string>();
        for (const material of materials) {
            if (material.item.trim().length === 0) {
                return { type: 'INVALID_MATERIAL', message: 'material item is empty' };
            }
            if (!Number.isInteger(material.count) || material.count < 0) {
                return {
                    type: 'INVALID_MATERIAL',
                    message: `material ${material.item} count must be a non-negative integer`,
                };
            }
            if (items.has(material.item)) {
                return {
                    type: 'INVALID_MATERIAL',
                    message: `material ${material.item} is declared twice`,
                };
            }
            items.add(material.item);
        }
        const required = new Map(
            BlueprintIr.materialNeeds(blocks).map((need) => [need.item, need.count]),
        );
        const missing = [...required.entries()].find(([item, count]) => {
            const declared = materials.find((material) => material.item === item);
            if (declared !== undefined) return declared.count < count;
            return materials.length > 0;
        });
        if (missing !== undefined) {
            return {
                type: 'INVALID_MATERIAL',
                message: `material ${missing[0]} is under-declared`,
            };
        }
        return null;
    }

    private static validateConstraints(blueprint: Blueprint): BuildingFailure | null {
        for (const constraint of blueprint.constraints) {
            switch (constraint.kind) {
                case 'protected':
                    if (!BlueprintValidator.isBounds(constraint.bbox)) {
                        return {
                            type: 'INVALID_CONSTRAINT',
                            message: 'protected constraint bounds are invalid',
                        };
                    }
                    break;
                case 'no-build':
                    if (constraint.polygon.length < 3) {
                        return {
                            type: 'INVALID_CONSTRAINT',
                            message: 'no-build polygon needs at least three points',
                        };
                    }
                    break;
                case 'support':
                    if (!BlueprintValidator.isPosition(constraint.position)) {
                        return {
                            type: 'INVALID_CONSTRAINT',
                            message: 'support position must use integer coordinates',
                        };
                    }
                    break;
            }
        }
        return null;
    }

    private static validateRegions(
        blocks: readonly BlueprintBlock[],
        rules: BlueprintRulesView,
    ): BuildingFailure | null {
        const protectedBboxes = rules.protectedBboxes ?? [];
        const noBuildZones = rules.noBuildZones ?? [];
        for (const block of blocks) {
            if (BlueprintIr.isAir(block.state.name)) continue;
            const position = BlueprintIr.position(block);
            if (protectedBboxes.some((bounds) => BlueprintIr.contains(bounds, position))) {
                return { type: 'PROTECTED_REGION', position };
            }
            if (
                noBuildZones.some((polygon) => BlueprintValidator.insidePolygon(position, polygon))
            ) {
                return { type: 'NO_BUILD_ZONE', position };
            }
        }
        return null;
    }

    private static insidePolygon(position: Vec3, polygon: readonly Vec3[]): boolean {
        let inside = false;
        for (
            let currentIndex = 0, previousIndex = polygon.length - 1;
            currentIndex < polygon.length;
            previousIndex = currentIndex, currentIndex += 1
        ) {
            const current = polygon[currentIndex];
            const previous = polygon[previousIndex];
            if (current === undefined || previous === undefined) continue;
            const intersects =
                current.z > position.z !== previous.z > position.z &&
                position.x <
                    ((previous.x - current.x) * (position.z - current.z)) /
                        (previous.z - current.z) +
                        current.x;
            if (intersects) inside = !inside;
        }
        return inside;
    }

    private static isPosition(position: Vec3): boolean {
        return (
            Number.isInteger(position.x) &&
            Number.isInteger(position.y) &&
            Number.isInteger(position.z)
        );
    }

    private static isIntegerPosition(block: BlueprintBlock): boolean {
        return Number.isInteger(block.x) && Number.isInteger(block.y) && Number.isInteger(block.z);
    }

    private static isBounds(bounds: BlueprintBoundingBox): boolean {
        return (
            BlueprintValidator.isPosition(bounds.min) &&
            BlueprintValidator.isPosition(bounds.max) &&
            bounds.min.x <= bounds.max.x &&
            bounds.min.y <= bounds.max.y &&
            bounds.min.z <= bounds.max.z
        );
    }
}

import type { Vec3 } from '@ticrafter/core';

import type { SkillBBox, SkillBuildTarget } from './types.js';
import { SkillSharedUtilities } from './utilities.js';

export class WorldScan {
    static key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }

    static below(position: Vec3): Vec3 {
        return { x: position.x, y: position.y - 1, z: position.z };
    }

    static isAir(blockId: string | null): boolean {
        return (
            blockId === null ||
            blockId === 'air' ||
            blockId === 'cave_air' ||
            blockId === 'void_air'
        );
    }

    static positionsInBox(bbox: SkillBBox): readonly Vec3[] {
        const positions: Vec3[] = [];
        const minimumX = Math.floor(Math.min(bbox.min.x, bbox.max.x));
        const maximumX = Math.floor(Math.max(bbox.min.x, bbox.max.x));
        const minimumY = Math.floor(Math.min(bbox.min.y, bbox.max.y));
        const maximumY = Math.floor(Math.max(bbox.min.y, bbox.max.y));
        const minimumZ = Math.floor(Math.min(bbox.min.z, bbox.max.z));
        const maximumZ = Math.floor(Math.max(bbox.min.z, bbox.max.z));
        for (let y = minimumY; y <= maximumY; y += 1) {
            for (let x = minimumX; x <= maximumX; x += 1) {
                for (let z = minimumZ; z <= maximumZ; z += 1) {
                    positions.push({ x, y, z });
                }
            }
        }
        return positions;
    }

    static keys(positions: readonly Vec3[]): readonly string[] {
        return positions.map((position) => WorldScan.key(position));
    }

    static readPositions(value: unknown): readonly Vec3[] | null {
        if (!Array.isArray(value)) return null;
        const positions: Vec3[] = [];
        for (const entry of value) {
            const position = SkillSharedUtilities.readVec3(entry);
            if (position === null) return null;
            positions.push(position);
        }
        return positions;
    }

    static readStrings(value: unknown): readonly string[] | null {
        if (!Array.isArray(value)) return null;
        const strings = value.filter((entry): entry is string => typeof entry === 'string');
        return strings.length === value.length ? strings : null;
    }

    static readTarget(value: unknown): SkillBuildTarget | null {
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const position = SkillSharedUtilities.readVec3(value.position);
        const itemName = SkillSharedUtilities.readString(value.itemName);
        if (position === null || itemName === null) return null;
        const expectedBlockId = SkillSharedUtilities.readString(value.expectedBlockId);
        return {
            position,
            itemName,
            ...(expectedBlockId === null ? {} : { expectedBlockId }),
        };
    }

    static readTargets(value: unknown): readonly SkillBuildTarget[] | null {
        if (!Array.isArray(value)) return null;
        const targets: SkillBuildTarget[] = [];
        for (const entry of value) {
            const target = WorldScan.readTarget(entry);
            if (target === null) return null;
            targets.push(target);
        }
        return targets;
    }
}

import type { Vec3 } from '@ticrafter/core';

import type { WorldCacheAdapter } from './world-cache.js';

const HOME_PADDING = 1;
const AIR_BLOCKS = new Set(['air', 'cave_air', 'void_air']);
const UNSAFE_DIG_BLOCKS = new Set([
    'water',
    'lava',
    'bedrock',
    'chest',
    'trapped_chest',
    'barrel',
    'furnace',
]);

export interface HomeInspectionBounds {
    min: Vec3;
    max: Vec3;
}

export interface ShelterInspection {
    isSheltered: boolean;
    hasBed: boolean;
    digSite: Vec3 | null;
}

export class ShelterInspector {
    static inspect(
        world: WorldCacheAdapter,
        position: Vec3,
        home: HomeInspectionBounds | null,
    ): ShelterInspection {
        const homeBlocks = home === null ? [] : world.blocksInBox(home);
        const atHome = home !== null && ShelterInspector.contains(position, home, HOME_PADDING);
        return {
            isSheltered: atHome && ShelterInspector.isSheltered(homeBlocks, home),
            hasBed: homeBlocks.some((block) => block.name.endsWith('_bed')),
            digSite: ShelterInspector.findDigSite(world, position),
        };
    }

    static contains(position: Vec3, home: HomeInspectionBounds, padding = 0): boolean {
        return (
            position.x >= home.min.x - padding &&
            position.x <= home.max.x + padding &&
            position.y >= home.min.y - padding &&
            position.y <= home.max.y + padding &&
            position.z >= home.min.z - padding &&
            position.z <= home.max.z + padding
        );
    }

    static isSheltered(
        blocks: readonly { name: string; position: Vec3 }[],
        home: HomeInspectionBounds | null,
    ): boolean {
        if (home === null || blocks.length === 0) return false;
        const roofHeight = home.min.y + 2;
        const wallHeight = home.min.y + 1;
        const roof = blocks.filter(
            (block) => block.position.y >= roofHeight && !AIR_BLOCKS.has(block.name),
        );
        const walls = blocks.filter(
            (block) =>
                block.position.y === wallHeight &&
                !AIR_BLOCKS.has(block.name) &&
                ShelterInspector.onPerimeter(block.position, home),
        );
        return roof.length > 0 && walls.length >= 4;
    }

    static findDigSite(world: WorldCacheAdapter, position: Vec3): Vec3 | null {
        const origin = {
            x: Math.floor(position.x),
            y: Math.floor(position.y),
            z: Math.floor(position.z),
        };
        const candidates: Vec3[] = [
            { x: origin.x + 1, y: origin.y, z: origin.z },
            { x: origin.x - 1, y: origin.y, z: origin.z },
            { x: origin.x, y: origin.y, z: origin.z + 1 },
            { x: origin.x, y: origin.y, z: origin.z - 1 },
        ];
        return candidates.find((candidate) => ShelterInspector.canDig(world, candidate)) ?? null;
    }

    private static canDig(world: WorldCacheAdapter, position: Vec3): boolean {
        const feet = world.blockAt(position);
        const head = world.blockAt({ x: position.x, y: position.y + 1, z: position.z });
        const floor = world.blockAt({ x: position.x, y: position.y - 1, z: position.z });
        return (
            ShelterInspector.isSolid(feet) &&
            ShelterInspector.isSolid(head) &&
            ShelterInspector.isSolid(floor)
        );
    }

    private static isSolid(blockName: string | null): boolean {
        if (blockName === null) return false;
        if (AIR_BLOCKS.has(blockName)) return false;
        return !UNSAFE_DIG_BLOCKS.has(blockName);
    }

    private static onPerimeter(position: Vec3, home: HomeInspectionBounds): boolean {
        return (
            position.x === home.min.x ||
            position.x === home.max.x ||
            position.z === home.min.z ||
            position.z === home.max.z
        );
    }
}

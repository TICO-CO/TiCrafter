import type { Vec3 as CoreVec3 } from '@ticrafter/core';
import type { SkillBBox, SkillBlock, SkillBlockState, SkillWorldView } from '@ticrafter/skills';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface BlockSnapshot {
    name: string;
    position: CoreVec3;
}

const CONTAINER_BLOCKS = ['chest', 'trapped_chest', 'barrel', 'furnace'];
const MAX_SCAN_BLOCKS = 4096;
const MAX_SEARCH_DISTANCE = 64;

export class WorldCacheAdapter implements SkillWorldView {
    constructor(private readonly bot: Bot) {}

    getBlock(position: CoreVec3): BlockSnapshot | null {
        const block = this.bot.blockAt(this.vector(position));
        if (!block) return null;
        return {
            name: block.name,
            position: { x: block.position.x, y: block.position.y, z: block.position.z },
        };
    }

    blockAt(position: CoreVec3): string | null {
        return this.bot.blockAt(this.vector(position))?.name ?? null;
    }

    blockStateAt(position: CoreVec3): SkillBlockState | null {
        const block = this.bot.blockAt(this.vector(position), true);
        if (!block) return null;
        return {
            name: block.name,
            properties: this.properties(block),
        };
    }

    blocksInBox(bbox: SkillBBox): readonly SkillBlock[] {
        const minimumX = Math.floor(Math.min(bbox.min.x, bbox.max.x));
        const maximumX = Math.floor(Math.max(bbox.min.x, bbox.max.x));
        const minimumY = Math.floor(Math.min(bbox.min.y, bbox.max.y));
        const maximumY = Math.floor(Math.max(bbox.min.y, bbox.max.y));
        const minimumZ = Math.floor(Math.min(bbox.min.z, bbox.max.z));
        const maximumZ = Math.floor(Math.max(bbox.min.z, bbox.max.z));
        const volume =
            (maximumX - minimumX + 1) * (maximumY - minimumY + 1) * (maximumZ - minimumZ + 1);
        if (volume <= 0 || volume > MAX_SCAN_BLOCKS) return [];
        const blocks: SkillBlock[] = [];
        for (let y = minimumY; y <= maximumY; y += 1) {
            for (let x = minimumX; x <= maximumX; x += 1) {
                for (let z = minimumZ; z <= maximumZ; z += 1) {
                    const position = { x, y, z };
                    const block = this.bot.blockAt(this.vector(position));
                    if (block === null) continue;
                    blocks.push({
                        name: block.name,
                        position,
                        properties: this.properties(block),
                    });
                }
            }
        }
        return blocks;
    }

    nearestBlock(names: readonly string[], maxDistance: number): CoreVec3 | null {
        if (names.length === 0) return null;
        const distance = Math.min(Math.max(0, maxDistance), MAX_SEARCH_DISTANCE);
        const patterns = names.map((name) => WorldCacheAdapter.pattern(name));
        const block = this.bot.findBlock({
            matching: (candidate) => patterns.some((pattern) => pattern.test(candidate.name)),
            maxDistance: distance,
        });
        if (!block) return null;
        return { x: block.position.x, y: block.position.y, z: block.position.z };
    }

    nearestContainer(maxDistance: number): CoreVec3 | null {
        const blockIds = CONTAINER_BLOCKS.map(
            (name) => this.bot.registry.blocksByName[name]?.id,
        ).filter((id): id is number => id !== undefined);
        if (blockIds.length === 0) return null;
        const block = this.bot.findBlock({ matching: blockIds, maxDistance });
        if (!block) return null;
        return { x: block.position.x, y: block.position.y, z: block.position.z };
    }

    entities(): readonly { id?: number; name: string; position: CoreVec3 }[] {
        return Object.values(this.bot.entities).map((entity) => ({
            id: entity.id,
            name: entity.name ?? 'unknown',
            position: {
                x: entity.position.x,
                y: entity.position.y,
                z: entity.position.z,
            },
        }));
    }

    private properties(block: {
        getProperties?: () => Record<string, string | number | boolean>;
    }): Record<string, string> {
        const properties = block.getProperties?.() ?? {};
        return Object.fromEntries(
            Object.entries(properties).map(([key, value]) => [key, String(value)]),
        );
    }

    private static pattern(name: string): RegExp {
        const escaped = name
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*');
        return new RegExp(`^${escaped}$`);
    }

    private vector(position: CoreVec3): Vec3 {
        return new Vec3(position.x, position.y, position.z);
    }
}

import type { Vec3 as CoreVec3 } from '@ticrafter/core';
import type { SkillWorldView } from '@ticrafter/skills';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface BlockSnapshot {
    name: string;
    position: CoreVec3;
}

const CONTAINER_BLOCKS = ['chest', 'trapped_chest', 'barrel', 'furnace'];

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

    nearestContainer(maxDistance: number): CoreVec3 | null {
        const blockIds = CONTAINER_BLOCKS.map(
            (name) => this.bot.registry.blocksByName[name]?.id,
        ).filter((id): id is number => id !== undefined);
        if (blockIds.length === 0) return null;
        const block = this.bot.findBlock({ matching: blockIds, maxDistance });
        if (!block) return null;
        return { x: block.position.x, y: block.position.y, z: block.position.z };
    }

    entities(): readonly { name: string; position: CoreVec3 }[] {
        return Object.values(this.bot.entities).map((entity) => ({
            name: entity.name ?? 'unknown',
            position: {
                x: entity.position.x,
                y: entity.position.y,
                z: entity.position.z,
            },
        }));
    }

    private vector(position: CoreVec3): Vec3 {
        return new Vec3(position.x, position.y, position.z);
    }
}

import type { Result, Vec3 } from '@ticrafter/core';
import type { SkillContext, SkillContextSource, SkillHostile } from '@ticrafter/skills';
import type { Bot } from 'mineflayer';

import type { WorldCacheAdapter } from './world-cache.js';

const HOSTILE_MOBS = new Set([
    'blaze',
    'creeper',
    'drowned',
    'enderman',
    'husk',
    'phantom',
    'pillager',
    'skeleton',
    'slime',
    'spider',
    'stray',
    'witch',
    'wither_skeleton',
    'zombie',
    'zombie_villager',
]);

export class BotSkillContextSource implements SkillContextSource {
    constructor(
        private readonly bot: Bot,
        private readonly world: WorldCacheAdapter,
        private readonly taskId?: string,
    ) {}

    read(): Result<Omit<SkillContext, 'lastAction'>, string> {
        const position = this.position();
        const timeOfDay = this.timeOfDay();
        const isSleeping = this.isSleeping();
        return [
            {
                botId: `bot.${this.bot.username.toLowerCase()}`,
                ...(this.taskId === undefined ? {} : { taskId: this.taskId }),
                at: new Date().toISOString(),
                position,
                health: Number(this.bot.health ?? 0),
                food: Number(this.bot.food ?? 0),
                ...(timeOfDay === undefined ? {} : { timeOfDay }),
                ...(isSleeping === undefined ? {} : { isSleeping }),
                inventory: this.bot.inventory.items().map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
                world: this.world,
                nearestHostile: this.nearestHostile(position),
            },
            null,
        ];
    }

    private timeOfDay(): number | undefined {
        const timeOfDay = this.bot.time?.timeOfDay;
        return typeof timeOfDay === 'number' ? timeOfDay : undefined;
    }

    private isSleeping(): boolean | undefined {
        return typeof this.bot.isSleeping === 'boolean' ? this.bot.isSleeping : undefined;
    }

    private position(): Vec3 {
        const position = this.bot.entity?.position ?? { x: 0, y: 0, z: 0 };
        return { x: position.x, y: position.y, z: position.z };
    }

    private nearestHostile(position: Vec3): SkillHostile | null {
        const hostiles = Object.values(this.bot.entities)
            .filter((entity) => entity.name !== undefined && HOSTILE_MOBS.has(entity.name))
            .map((entity) => ({
                entityId: entity.id,
                name: entity.name ?? 'unknown',
                position: {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z,
                },
                distance: this.distance(position, entity.position),
            }));
        if (hostiles.length === 0) return null;
        return hostiles.reduce((nearest, current) =>
            current.distance < nearest.distance ? current : nearest,
        );
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}

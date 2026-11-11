import type { Result, Vec3 } from '@ticrafter/core';
import type {
    SkillContext,
    SkillContextSource,
    SkillHostile,
    SkillServices,
} from '@ticrafter/skills';
import type { Bot } from 'mineflayer';

import { HostileScanner } from './hostile-scanner.js';
import type { WorldCacheAdapter } from './world-cache.js';

export class BotSkillContextSource implements SkillContextSource {
    private readonly hostileScanner: HostileScanner;

    constructor(
        private readonly bot: Bot,
        private readonly world: WorldCacheAdapter,
        private readonly services: SkillServices | undefined = undefined,
        private readonly taskId?: string,
    ) {
        this.hostileScanner = new HostileScanner(bot, world);
    }

    read(): Result<Omit<SkillContext, 'lastAction'>, string> {
        const position = this.position();
        const timeOfDay = this.timeOfDay();
        const isSleeping = this.isSleeping();
        const hostiles = this.hostileScanner.scan(position);
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
                hostiles,
                nearestHostile: this.nearestHostile(hostiles),
                ...(this.services === undefined ? {} : { services: this.services }),
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

    private nearestHostile(hostiles: readonly SkillHostile[]): SkillHostile | null {
        if (hostiles.length === 0) return null;
        return hostiles.reduce((nearest, current) =>
            current.distance < nearest.distance ? current : nearest,
        );
    }
}

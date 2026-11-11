import type { BotHeartbeat } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

import { HostileScanner } from './hostile-scanner.js';

export class StateDigest {
    static collect(bot: Bot, currentSkill: string | null = null): BotHeartbeat['digest'] {
        const position = bot.entity?.position ?? { x: 0, y: 0, z: 0 };
        const inventory = bot.inventory?.items() ?? [];
        return {
            health: Number(bot.health ?? 0),
            food: Number(bot.food ?? 0),
            position: { x: position.x, y: position.y, z: position.z },
            inventoryCount: inventory.length,
            ...(currentSkill === null ? {} : { currentSkill }),
            inventorySummary: inventory.slice(0, 8).map((item) => ({
                name: item.name,
                count: item.count,
            })),
            hazards: this.hazards(bot, position),
        };
    }

    private static hazards(bot: Bot, position: { x: number; y: number; z: number }): string[] {
        return Object.values(bot.entities)
            .filter((entity) => HostileScanner.isHostile(entity.name))
            .filter(
                (entity) =>
                    Math.sqrt(
                        (entity.position.x - position.x) ** 2 +
                            (entity.position.y - position.y) ** 2 +
                            (entity.position.z - position.z) ** 2,
                    ) <= 16,
            )
            .map((entity) => entity.name ?? 'unknown');
    }
}

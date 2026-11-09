import type { BotHeartbeat } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

export class StateDigest {
    static collect(bot: Bot): BotHeartbeat['digest'] {
        const position = bot.entity?.position ?? { x: 0, y: 0, z: 0 };
        return {
            health: Number(bot.health ?? 0),
            food: Number(bot.food ?? 0),
            position: { x: position.x, y: position.y, z: position.z },
            inventoryCount: bot.inventory?.items().length ?? 0,
        };
    }
}

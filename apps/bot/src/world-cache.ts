import type { Bot } from 'mineflayer';

export interface BlockSnapshot {
    name: string;
    position: { x: number; y: number; z: number };
}

export class WorldCacheAdapter {
    constructor(private readonly bot: Bot) {}

    getBlock(position: { x: number; y: number; z: number }): BlockSnapshot | null {
        const block = this.bot.blockAt({ x: position.x, y: position.y, z: position.z } as never);
        if (!block) return null;
        return {
            name: block.name,
            position: { x: block.position.x, y: block.position.y, z: block.position.z },
        };
    }
}

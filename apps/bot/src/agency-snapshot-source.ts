import type { AgencySnapshot } from '@ticrafter/agency';
import type { Result } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

import { StateDigest } from './state-digest.js';
import type { WorldCacheAdapter } from './world-cache.js';

const BED_RADIUS = 32;
const RESOURCE_RADIUS = 32;

export interface AgencySnapshotSourceOptions {
    bot: Bot;
    world: WorldCacheAdapter;
    home?: () => { x: number; y: number; z: number } | null;
    now?: () => Date;
}

export class AgencySnapshotSource {
    constructor(private readonly options: AgencySnapshotSourceOptions) {}

    read(): Result<AgencySnapshot, string> {
        const bot = this.options.bot;
        const position = bot.entity?.position;
        if (position === undefined) return [null, 'bot position unavailable'];
        const digest = StateDigest.collect(bot);
        const inventory = (bot.inventory?.items() ?? []).map((item) => ({
            name: item.name,
            count: item.count,
        }));
        const players = Object.values(bot.players)
            .map((player) => player.username)
            .filter((username) => username !== bot.username);
        return [
            {
                at: (this.options.now?.() ?? new Date()).toISOString(),
                position: { x: position.x, y: position.y, z: position.z },
                health: digest.health,
                food: digest.food,
                timeOfDay: bot.time?.timeOfDay ?? null,
                inventory,
                nearbyBots: [],
                nearbyPlayers: players,
                hostiles: digest.hazards ?? [],
                home: this.options.home?.() ?? null,
                hasBed: this.bedNearby(),
                knownResourceSites: this.resourceSites(),
            },
            null,
        ];
    }

    private bedNearby(): boolean {
        return this.options.world.nearestBlock(['*_bed'], BED_RADIUS) !== null;
    }

    private resourceSites(): readonly {
        kind: string;
        position: { x: number; y: number; z: number };
    }[] {
        const sites: { kind: string; position: { x: number; y: number; z: number } }[] = [];
        const wood = this.options.world.nearestBlock(['*_log'], RESOURCE_RADIUS);
        if (wood !== null) sites.push({ kind: 'wood', position: wood });
        const stone = this.options.world.nearestBlock(['stone', 'deepslate'], RESOURCE_RADIUS);
        if (stone !== null) sites.push({ kind: 'stone', position: stone });
        return sites;
    }
}

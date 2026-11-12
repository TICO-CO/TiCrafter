import type {
    AgencySnapshot,
    HomeStatus,
    NightIntent,
    ProjectSummary,
    SnapshotBoundingBox,
} from '@ticrafter/agency';
import type { Result } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

import { ShelterInspector } from './shelter-inspector.js';
import { StateDigest } from './state-digest.js';
import type { WorldCacheAdapter } from './world-cache.js';

const BED_RADIUS = 32;
const RESOURCE_RADIUS = 32;
const ARMOR_SUFFIXES = ['_helmet', '_chestplate', '_leggings', '_boots'];

export interface AgencyHomeSnapshot {
    anchor: { x: number; y: number; z: number };
    bbox: SnapshotBoundingBox;
    status: HomeStatus;
    structureId: string | null;
}

export interface AgencySnapshotSourceOptions {
    bot: Bot;
    world: WorldCacheAdapter;
    home?: () => AgencyHomeSnapshot | null;
    project?: () => ProjectSummary | null;
    nightIntent?: () => NightIntent | null;
    now?: () => Date;
}

export class AgencySnapshotSource {
    constructor(private readonly options: AgencySnapshotSourceOptions) {}

    read(): Result<AgencySnapshot, string> {
        const bot = this.options.bot;
        const position = bot.entity?.position;
        if (position === undefined) return [null, 'bot position unavailable'];
        const digest = StateDigest.collect(bot);
        const snapshotPosition = { x: position.x, y: position.y, z: position.z };
        const inventory = (bot.inventory?.items() ?? []).map((item) => ({
            name: item.name,
            count: item.count,
        }));
        const players = Object.values(bot.players)
            .map((player) => player.username)
            .filter((username) => username !== bot.username);
        const home = this.options.home?.() ?? null;
        const inspection = ShelterInspector.inspect(
            this.options.world,
            snapshotPosition,
            home?.bbox ?? null,
        );
        return [
            {
                at: (this.options.now?.() ?? new Date()).toISOString(),
                position: snapshotPosition,
                health: digest.health,
                food: digest.food,
                timeOfDay: bot.time?.timeOfDay ?? null,
                inventory,
                nearbyBots: [],
                nearbyPlayers: players,
                hostiles: digest.hazards ?? [],
                home: home?.anchor ?? null,
                hasBed: this.bedNearby(),
                knownResourceSites: this.resourceSites(),
                homeBbox: home?.bbox ?? null,
                homeStatus: home?.status ?? null,
                homeStructureId: home?.structureId ?? null,
                hasBedAtHome: inspection.hasBed,
                isSheltered: inspection.isSheltered,
                digSite: inspection.digSite,
                weapon: this.weapon(bot),
                armorPieces: this.armorPieces(bot),
                armorInventoryPieces: this.armorInventoryPieces(inventory),
                nightIntent: this.options.nightIntent?.() ?? null,
                project: this.options.project?.() ?? null,
            },
            null,
        ];
    }

    private bedNearby(): boolean {
        return this.options.world.nearestBlock(['*_bed'], BED_RADIUS) !== null;
    }

    private weapon(bot: Bot): { name: string; tier: number } | null {
        const held = bot.heldItem;
        if (held === null || held === undefined) return null;
        const tier = AgencySnapshotSource.weaponTier(held.name);
        return tier === 0 ? null : { name: held.name, tier };
    }

    private armorPieces(bot: Bot): number {
        return bot.inventory.slots
            .slice(5, 9)
            .filter((item): item is NonNullable<typeof item> => item !== null).length;
    }

    private armorInventoryPieces(inventory: readonly { name: string; count: number }[]): number {
        return inventory
            .filter((item) => ARMOR_SUFFIXES.some((suffix) => item.name.endsWith(suffix)))
            .reduce((total, item) => total + item.count, 0);
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

    private static weaponTier(itemName: string): number {
        if (itemName.endsWith('_sword')) {
            if (itemName.startsWith('netherite')) return 5;
            if (itemName.startsWith('diamond')) return 4;
            if (itemName.startsWith('iron')) return 3;
            if (itemName.startsWith('stone')) return 2;
            return 1;
        }
        if (itemName.endsWith('_axe')) return 1;
        return 0;
    }
}

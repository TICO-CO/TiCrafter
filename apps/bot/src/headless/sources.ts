import type { AgencySnapshot, NightIntent, ProjectSummary } from '@ticrafter/agency';
import type { Result } from '@ticrafter/core';
import type {
    SkillContext,
    SkillContextSource,
    SkillHostile,
    SkillServices,
} from '@ticrafter/skills';

import type { AgencyHomeSnapshot } from '../index.js';
import type { BotPlatformPorts } from './ports.js';

export class HeadlessSkillContextSource implements SkillContextSource {
    constructor(
        private readonly botId: string,
        private readonly ports: BotPlatformPorts,
        private readonly services: SkillServices | undefined = undefined,
        private readonly taskId: string | undefined = undefined,
    ) {}

    read(): Result<Omit<SkillContext, 'lastAction'>, string> {
        const hostiles = this.ports.hostiles();
        const timeOfDay = this.ports.timeOfDay();
        return [
            {
                botId: this.botId,
                ...(this.taskId === undefined ? {} : { taskId: this.taskId }),
                at: new Date(this.ports.clock.now()).toISOString(),
                position: this.ports.position(),
                health: this.ports.health(),
                food: this.ports.food(),
                ...(timeOfDay === null ? {} : { timeOfDay }),
                inventory: this.ports.inventory.items(),
                world: this.ports.world,
                hostiles,
                nearestHostile: HeadlessSkillContextSource.nearest(hostiles),
                ...(this.services === undefined ? {} : { services: this.services }),
            },
            null,
        ];
    }

    private static nearest(hostiles: readonly SkillHostile[]): SkillHostile | null {
        if (hostiles.length === 0) return null;
        return hostiles.reduce((nearest, current) =>
            current.distance < nearest.distance ? current : nearest,
        );
    }
}

export class HeadlessAgencySnapshotSource {
    constructor(
        private readonly ports: BotPlatformPorts,
        private readonly home: () => AgencyHomeSnapshot | null,
        private readonly project: () => ProjectSummary | null,
        private readonly nightIntent: () => NightIntent | null,
        private readonly farmPlots: () => AgencySnapshot['farmPlots'] = () => [],
        private readonly villages: () => AgencySnapshot['villageCandidates'] = () => [],
    ) {}

    read(): Result<AgencySnapshot, string> {
        const home = this.home();
        const homeBlocks =
            home === null || this.ports.world.blocksInBox === undefined
                ? []
                : this.ports.world.blocksInBox(home.bbox);
        const hasBedAtHome = homeBlocks.some((block) => block.name.endsWith('_bed'));
        return [
            {
                at: new Date(this.ports.clock.now()).toISOString(),
                position: this.ports.position(),
                health: this.ports.health(),
                food: this.ports.food(),
                timeOfDay: this.ports.timeOfDay(),
                inventory: this.ports.inventory.items(),
                nearbyBots: [],
                nearbyPlayers: (this.ports.players?.() ?? []).map((player) => player.username),
                hostiles: this.ports.hostiles().map((hostile) => hostile.name),
                home: home?.anchor ?? null,
                hasBed: hasBedAtHome,
                knownResourceSites: this.ports.resources?.() ?? [],
                homeBbox: home?.bbox ?? null,
                homeStatus: home?.status ?? null,
                homeStructureId: home?.structureId ?? null,
                hasBedAtHome,
                isSheltered: hasBedAtHome,
                digSite: null,
                weapon: null,
                armorPieces: 0,
                armorInventoryPieces: 0,
                nightIntent: this.nightIntent(),
                project: this.project(),
                hasCraftingTable:
                    (this.ports.stations?.() ?? []).some(
                        (station) => station.kind === 'crafting_table',
                    ) || this.ports.world.nearestBlock?.(['crafting_table'], 32) != null,
                hasFurnace:
                    (this.ports.stations?.() ?? []).some((station) => station.kind === 'furnace') ||
                    this.ports.world.nearestBlock?.(['furnace'], 32) != null,
                hasContainer: this.ports.world.nearestContainer(32) !== null,
                stations: this.ports.stations?.() ?? [],
                waterSources: this.ports.waterSources?.() ?? [],
                farmPlots: this.farmPlots(),
                villageCandidates: this.villages(),
            },
            null,
        ];
    }
}

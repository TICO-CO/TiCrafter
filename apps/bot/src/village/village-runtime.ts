import type { AgencySnapshot } from '@ticrafter/agency';
import type { ClockPort, LoggerPort, Result, TicrafterConfig } from '@ticrafter/core';
import type { DetectionCandidate, VillageObservation } from '@ticrafter/perception';
import type { SkillFarmPlotSource } from '@ticrafter/skills';
import { FarmPermissionPolicy, type PlotOwnership } from '@ticrafter/worldmodel';

import {
    AuthorizedFarmPlotSource,
    FarmPermissionCoordinator,
    FarmPermissionService,
    type FarmPlotRef,
    FarmPlotRegistry,
    type FarmPlotWorldPort,
} from '../farming/index.js';
import type { BehaviorTracePort } from '../index.js';
import { VillageObservationRegistry } from './village-observation-registry.js';

export interface VillageChatPort {
    inquire(text: string, usernames: readonly string[]): Result<void, string>;
}

export interface VillageRuntimeOptions {
    botId: string;
    config: TicrafterConfig['behavior']['village'];
    clock: ClockPort;
    logger: LoggerPort;
    trace: BehaviorTracePort;
    world: FarmPlotWorldPort;
    ownership: (plot: FarmPlotRef) => Promise<Result<PlotOwnership, string>>;
    chat: VillageChatPort;
    onOutcome: (playerId: string, plotId: string, kept: boolean, at: string) => void;
}

export class VillageRuntime {
    readonly farmPlots: FarmPlotRegistry;
    readonly villages = new VillageObservationRegistry();
    readonly permissions: FarmPermissionService;
    private readonly coordinator: FarmPermissionCoordinator;

    constructor(private readonly options: VillageRuntimeOptions) {
        this.farmPlots = new FarmPlotRegistry({ world: options.world });
        this.permissions = new FarmPermissionService({
            policy: new FarmPermissionPolicy(),
            confidenceThreshold: options.config.playerConfidenceThreshold,
            grantTtlMilliseconds: options.config.permissionGrantTtlMs,
            askCooldownMilliseconds: options.config.permissionAskCooldownMs,
            inquiryTimeoutMilliseconds: options.config.permissionTimeoutMs,
            ownership: options.ownership,
            inquiry: (plotId, usernames) =>
                options.chat.inquire(`May I harvest and replant the farm at ${plotId}?`, usernames),
            trace: options.trace,
            now: () => options.clock.now(),
            allowedRegions: () =>
                options.config.allowedPlotRegions.map((region) => ({
                    id: region.id,
                    bbox: { min: region.min, max: region.max },
                })),
            onOutcome: options.onOutcome,
        });
        this.coordinator = new FarmPermissionCoordinator({
            plots: () => this.plots(),
            permissions: this.permissions,
            clock: options.clock,
            logger: options.logger,
            intervalMilliseconds: Math.max(5000, options.config.permissionAskCooldownMs / 10),
        });
    }

    start(): void {
        this.coordinator.start();
    }

    stop(): void {
        this.coordinator.stop();
    }

    observeCandidates(
        candidates: readonly DetectionCandidate[],
        villagers: VillageObservation['villagers'] = [],
    ): void {
        const farmland: { x: number; y: number; z: number }[] = [];
        const workstations: { x: number; y: number; z: number }[] = [];
        for (const candidate of candidates) {
            if (candidate.type === 'farm') {
                this.farmPlots.observe(candidate);
                farmland.push({
                    x: (candidate.bbox.min.x + candidate.bbox.max.x) / 2,
                    y: (candidate.bbox.min.y + candidate.bbox.max.y) / 2,
                    z: (candidate.bbox.min.z + candidate.bbox.max.z) / 2,
                });
            }
            if (candidate.type === 'storage' || candidate.type === 'workstation') {
                const anchor = candidate.anchors[0];
                if (anchor !== undefined) workstations.push(anchor.position);
            }
        }
        this.villages.update({ villagers, beds: [], doors: [], workstations, farmland });
    }

    farmSource(): SkillFarmPlotSource {
        return new AuthorizedFarmPlotSource(this.farmPlots, this.permissions);
    }

    farmSnapshots(): AgencySnapshot['farmPlots'] {
        return this.farmPlots.list().map((plot) => ({
            id: plot.id,
            bbox: plot.bbox,
            ...(plot.cropBlockIds === undefined ? {} : { cropBlockIds: plot.cropBlockIds }),
            ...(plot.seedItem === undefined ? {} : { seedItem: plot.seedItem }),
            permitted: this.permissions.isPermitted(plot.id),
        }));
    }

    villageSnapshots(): AgencySnapshot['villageCandidates'] {
        return this.villages.list().map((candidate) => ({
            id: candidate.id,
            bbox: { min: candidate.min, max: candidate.max },
            confidence: candidate.confidence,
        }));
    }

    handlePermissionReply(playerId: string, message: string): boolean {
        const [handled] = this.permissions.handleReply(playerId, message);
        return handled === true;
    }

    plots(): readonly FarmPlotRef[] {
        return this.farmPlots.list().map((plot) => ({
            id: plot.id,
            bbox: plot.bbox,
        }));
    }
}

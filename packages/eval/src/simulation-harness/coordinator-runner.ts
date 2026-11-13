import path from 'node:path';

import type { ClaimRecord } from '@ticrafter/coordinator/claims';
import { ClaimRepository } from '@ticrafter/coordinator/claims';
import { CoordinatorComposition } from '@ticrafter/coordinator/composition';
import { EpochStore } from '@ticrafter/coordinator/core';
import { type TaskRecord, TaskRepository, type TaskRole } from '@ticrafter/coordinator/tasks';
import {
    type ClockPort,
    ConfigErrorFormatter,
    ConfigFixture,
    type LoggerPort,
    PlannerSecretsLoader,
    type Result,
    type TicrafterConfig,
} from '@ticrafter/core';
import {
    MigrationRunner,
    SchemaVersionRegistry,
    SqliteRuntime,
    WorldStore,
} from '@ticrafter/memory';
import { SqliteLandmarkStore } from '@ticrafter/worldmodel';

import type { ScenarioAssertion } from '../behavior-assertions/index.js';
import { FakeContainers } from './fake-containers.js';
import { FakeInventory } from './fake-inventory.js';
import { FakeProcurementCatalog } from './fake-procurement.js';
import { FakeWorld } from './fake-world.js';
import { FreePort } from './free-port.js';
import type { BehaviorScenario } from './scenario.js';
import type { SimulationClock } from './simulation-clock.js';

export interface CoordinatorRunnerOptions {
    repositoryRoot: string;
    dataDirectory: string;
    scenario: BehaviorScenario;
    clock: SimulationClock;
    transportPort?: number;
    opsPort?: number;
    seed?: boolean;
}

export interface RunningCoordinator {
    config: TicrafterConfig;
    database: NonNullable<ReturnType<typeof SqliteRuntime.prototype.open>[0]>;
    close: () => Promise<void>;
}

class NullLogger implements LoggerPort {
    debug(): void {}
    info(): void {}
    warn(payload: unknown, message?: string): void {
        void payload;
        void message;
    }
    error(payload: unknown, message?: string): void {
        void payload;
        void message;
    }
}

export class CoordinatorRunner {
    static async start(
        options: CoordinatorRunnerOptions,
    ): Promise<Result<RunningCoordinator, string>> {
        const [transportPort, transportError] =
            options.transportPort === undefined
                ? await FreePort.allocate()
                : [options.transportPort, null];
        if (transportError || transportPort === null) return [null, transportError ?? 'no port'];
        const [opsPort, opsError] =
            options.opsPort === undefined ? await FreePort.allocate() : [options.opsPort, null];
        if (opsError || opsPort === null) return [null, opsError ?? 'no port'];
        const [config, configError] = CoordinatorRunner.config(options, transportPort, opsPort);
        if (configError || config === null) return [null, configError ?? 'no config'];
        const [database, databaseError] = new SqliteRuntime({
            dataDir: options.dataDirectory,
        }).open();
        if (databaseError || database === null) {
            return [null, ConfigErrorFormatter.format(databaseError) ?? 'database open failed'];
        }
        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) {
            database.close();
            return [null, ConfigErrorFormatter.format(migrationError)];
        }
        const [schemaVersion, versionError] = new SchemaVersionRegistry(database).current();
        if (versionError || schemaVersion === null) {
            database.close();
            return [null, ConfigErrorFormatter.format(versionError) ?? 'schema version missing'];
        }
        const [epoch, epochError] = new EpochStore(database).bump();
        if (epochError || epoch === null) {
            database.close();
            return [null, ConfigErrorFormatter.format(epochError) ?? 'epoch missing'];
        }
        const [planner, plannerError] = new PlannerSecretsLoader(config).load();
        if (plannerError || planner === null) {
            database.close();
            return [null, ConfigErrorFormatter.format(plannerError) ?? 'planner secrets missing'];
        }
        const logger = new NullLogger();
        const coordinator = CoordinatorComposition.build({
            config,
            logger,
            database,
            epoch,
            schemaVersion,
            currentWorkingDirectory: options.repositoryRoot,
            planner,
            clock: options.clock,
        });
        if (options.seed !== false) {
            const [, landmarkError] = CoordinatorRunner.seedLandmarks(database, options, epoch);
            if (landmarkError) {
                await coordinator.close();
                return [null, landmarkError];
            }
            const [, claimError] = CoordinatorRunner.seedClaims(database, options, epoch);
            if (claimError) {
                await coordinator.close();
                return [null, claimError];
            }
            const [, seedError] = CoordinatorRunner.seedTasks(database, options, logger);
            if (seedError) {
                await coordinator.close();
                return [null, seedError];
            }
        }
        const [, startError] = await coordinator.start();
        if (startError) {
            await coordinator.close();
            return [null, startError];
        }
        return [
            {
                config,
                database,
                close: () => coordinator.close(),
            },
            null,
        ];
    }

    private static config(
        options: CoordinatorRunnerOptions,
        transportPort: number,
        opsPort: number,
    ): Result<TicrafterConfig, string> {
        const [base, baseError] = ConfigFixture.load();
        if (baseError || base === null) {
            return [null, ConfigErrorFormatter.format(baseError) ?? 'config fixture failed'];
        }
        const scenario = options.scenario;
        const { allowedPlotRegions, playerBaseLinks, ...villageRest } = scenario.village ?? {};
        const config: TicrafterConfig = {
            ...base,
            botCount: scenario.bots.length,
            botNames: scenario.bots.map((bot) => bot.name),
            autoSpawnBots: false,
            dataDir: options.dataDirectory,
            transport: { host: '127.0.0.1', port: transportPort },
            ops: { host: '127.0.0.1', port: opsPort },
            planner: { ...base.planner, enabled: false },
            agency: {
                ...base.agency,
                ...(scenario.agencyOverrides?.goalCadenceMilliseconds === undefined
                    ? {}
                    : {
                          goalCadenceMilliseconds: scenario.agencyOverrides.goalCadenceMilliseconds,
                      }),
                ...(scenario.agencyOverrides?.needDecayPerMinute === undefined
                    ? {}
                    : { needDecayPerMinute: scenario.agencyOverrides.needDecayPerMinute }),
                enabled: scenario.assumptions?.agency !== 'disabled',
                progression: {
                    ...base.agency.progression,
                    enabled:
                        scenario.assumptions?.progression !== 'disabled' &&
                        base.agency.progression.enabled,
                },
            },
            decision: { ...base.decision, enabled: false },
            training: { ...base.training, traceEnabled: true },
            behavior: {
                ...base.behavior,
                village: {
                    ...base.behavior.village,
                    ...villageRest,
                    ...(allowedPlotRegions === undefined
                        ? {}
                        : {
                              allowedPlotRegions: allowedPlotRegions.map((region) => ({
                                  ...region,
                                  min: { ...region.min },
                                  max: { ...region.max },
                              })),
                          }),
                    ...(playerBaseLinks === undefined
                        ? {}
                        : {
                              playerBaseLinks: playerBaseLinks.map((link) => ({ ...link })),
                          }),
                },
            },
        };
        return [config, null];
    }

    private static seedLandmarks(
        database: NonNullable<RunningCoordinator['database']>,
        options: CoordinatorRunnerOptions,
        _epoch: number,
    ): Result<void, string> {
        if (options.scenario.landmarks === undefined || options.scenario.landmarks.length === 0) {
            return [undefined, null];
        }
        const store = new SqliteLandmarkStore(new WorldStore(database));
        const now = new Date().toISOString();
        for (const landmark of options.scenario.landmarks) {
            const confidence = landmark.confidence ?? 0.9;
            const [, saveError] = store.save({
                id: landmark.id,
                type: landmark.type,
                bbox: landmark.bbox,
                anchors: [],
                confidence,
                confidenceUpdatedAt: now,
                lastSeen: now,
                evidence: [
                    {
                        sourceBotId: 'scenario',
                        observedAt: now,
                        confidence,
                        reliability: confidence,
                        details: 'scenario fixture',
                    },
                ],
                planId: null,
            });
            if (saveError) return [null, saveError.type];
        }
        return [undefined, null];
    }

    private static seedClaims(
        database: NonNullable<RunningCoordinator['database']>,
        options: CoordinatorRunnerOptions,
        epoch: number,
    ): Result<void, string> {
        if (options.scenario.claims === undefined || options.scenario.claims.length === 0) {
            return [undefined, null];
        }
        const repository = new ClaimRepository(database);
        const now = new Date(options.clock.now()).toISOString();
        const defaultExpiry = '2100-01-01T00:00:00.000Z';
        for (const claim of options.scenario.claims) {
            const record: ClaimRecord = {
                id: claim.id,
                resourceType: claim.resourceType,
                resourceId: claim.id,
                bbox: claim.bbox,
                botId: claim.ownerBotId,
                leaseUntil: claim.expiresAt ?? defaultExpiry,
                fencingToken: 1,
                status: 'active',
                taskId: null,
                parentClaimId: null,
                epoch,
                payload: {},
                createdAt: now,
                updatedAt: now,
            };
            const [, insertError] = repository.insert(record);
            if (insertError) return [null, insertError.type];
        }
        return [undefined, null];
    }

    private static seedTasks(
        database: NonNullable<RunningCoordinator['database']>,
        options: CoordinatorRunnerOptions,
        logger: LoggerPort,
    ): Result<void, string> {
        const repository = new TaskRepository(database);
        const now = new Date(options.clock.now()).toISOString();
        for (const task of options.scenario.tasks ?? []) {
            const record: TaskRecord = {
                id: task.id,
                parentId: null,
                title: task.title,
                status: 'pending',
                priority: 100,
                retryCount: 0,
                payload: { ...(task.payload ?? {}), skillId: task.skillId },
                dependencies: [...(task.dependsOn ?? [])],
                preconditions: [],
                requiredRole: (task.requiredRole ?? null) as TaskRole | null,
                target: task.target ?? null,
                claimedBy: null,
                leaseUntil: null,
                leaseToken: null,
                availableAt: new Date(
                    options.clock.now() + (task.delayMilliseconds ?? 0),
                ).toISOString(),
                failureClass: null,
                deadLetterReason: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            };
            const [, insertError] = repository.insert(record);
            if (insertError) return [null, JSON.stringify(insertError)];
            logger.info({ taskId: task.id }, 'seed task created');
        }
        return [undefined, null];
    }
}

export type { ScenarioAssertion };

export interface ScenarioRuntimePorts {
    world: FakeWorld;
    inventory: FakeInventory;
    containers: FakeContainers;
    procurement: FakeProcurementCatalog;
    repositoryRoot: string;
    dataDirectory: string;
}

export type { ClockPort };

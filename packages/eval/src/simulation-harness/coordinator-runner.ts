import path from 'node:path';

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
import { MigrationRunner, SchemaVersionRegistry, SqliteRuntime } from '@ticrafter/memory';

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
        const [transportPort, transportError] = await FreePort.allocate();
        if (transportError || transportPort === null) return [null, transportError ?? 'no port'];
        const [opsPort, opsError] = await FreePort.allocate();
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
        const [, seedError] = CoordinatorRunner.seedTasks(database, options, logger);
        if (seedError) {
            await coordinator.close();
            return [null, seedError];
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
                enabled: scenario.assumptions?.agency !== 'disabled',
            },
            decision: { ...base.decision, enabled: false },
            training: { ...base.training, traceEnabled: true },
        };
        return [config, null];
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
                dependencies: [],
                preconditions: [],
                requiredRole: (task.requiredRole ?? null) as TaskRole | null,
                target: task.target ?? null,
                claimedBy: null,
                leaseUntil: null,
                leaseToken: null,
                availableAt: now,
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

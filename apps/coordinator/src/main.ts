import path from 'node:path';

import {
    attempt,
    attemptAsync,
    ConfigErrorFormatter,
    ConfigLoader,
    HardwareProbe,
    LayaRuntimeResolver,
    type LoggerPort,
    PlannerSecretsLoader,
} from '@ticrafter/core';
import { MigrationRunner, SchemaVersionRegistry, SqliteRuntime } from '@ticrafter/memory';

import { NodeConfigSource } from './config-source.js';
import { CoordinatorComposition } from './coordinator-composition.js';
import { Coordinator, type CoordinatorDatabase, EpochStore } from './core/index.js';
import { NodeLoggerFactory } from './logger.js';
import { NodeSystemInfo } from './system-info.js';
import { SeedTaskApplicator, SeedTaskLoader } from './tasks/index.js';

export class CoordinatorMain {
    private logger: LoggerPort | null = null;

    async run(): Promise<void> {
        const currentWorkingDirectory = process.cwd();
        const configDirectory = path.resolve(currentWorkingDirectory, 'config');
        const [config, configError] = new ConfigLoader({
            source: new NodeConfigSource(configDirectory),
            environment: process.env,
        }).load();
        if (configError) return this.fail(ConfigErrorFormatter.format(configError));
        if (config === null) return this.fail('configuration returned null');
        const [seedTasks, seedTasksError] = SeedTaskLoader.load(configDirectory);
        if (seedTasksError) return this.fail(seedTasksError);
        if (seedTasks === null) return this.fail('seed tasks returned null');

        const logger = new NodeLoggerFactory().create('coordinator', config.logging.level);
        this.logger = logger;
        const dataDirectory = path.resolve(currentWorkingDirectory, config.dataDir);
        const [database, databaseError] = new SqliteRuntime({ dataDir: dataDirectory }).open();
        if (databaseError) return this.fail(this.describe(databaseError));
        if (database === null) return this.fail('database returned null');

        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) {
            this.closeDatabase(database);
            return this.fail(this.describe(migrationError));
        }

        const [schemaVersion, versionError] = new SchemaVersionRegistry(database).current();
        if (versionError) {
            this.closeDatabase(database);
            return this.fail(this.describe(versionError));
        }
        if (schemaVersion === null) {
            this.closeDatabase(database);
            return this.fail('schema version returned null');
        }

        const [epoch, epochError] = new EpochStore(database).bump();
        if (epochError) {
            this.closeDatabase(database);
            return this.fail(this.describe(epochError));
        }
        if (epoch === null) {
            this.closeDatabase(database);
            return this.fail('epoch returned null');
        }

        const [planner, plannerError] = new PlannerSecretsLoader(config).load();
        if (plannerError) {
            this.closeDatabase(database);
            return this.fail(ConfigErrorFormatter.format(plannerError));
        }
        if (planner === null) {
            this.closeDatabase(database);
            return this.fail('planner secrets returned null');
        }

        const hardware = new HardwareProbe(new NodeSystemInfo()).probe();
        const laya = LayaRuntimeResolver.resolve(config);
        logger.info({ epoch, dataDirectory, schemaVersion, hardware }, 'coordinator starting');
        logger.info(
            {
                laya,
                plannerEnabled: config.planner.enabled,
                plannerConfigured: Boolean(planner.baseUrl),
            },
            'runtime resolved',
        );

        const coordinator = CoordinatorComposition.build({
            config,
            logger,
            database: database,
            epoch,
            schemaVersion,
            currentWorkingDirectory: currentWorkingDirectory,
            planner: planner,
        });
        const [seedReport, seedApplyError] = new SeedTaskApplicator(
            coordinator.tasks,
            logger,
        ).apply(seedTasks);
        if (seedApplyError) {
            await coordinator.close();
            return this.fail(seedApplyError);
        }
        if (seedReport === null) {
            await coordinator.close();
            return this.fail('seed task apply returned null');
        }
        logger.info(seedReport, 'seed tasks applied');
        const [started, startError] = await coordinator.start();
        if (startError) {
            await coordinator.close();
            return this.fail(startError);
        }
        if (started === null) {
            await coordinator.close();
            return this.fail('coordinator start returned null');
        }

        this.installSignalHandlers(coordinator);
    }

    private installSignalHandlers(coordinator: Coordinator): void {
        process.on('SIGINT', () => void this.shutdown(coordinator, 'SIGINT'));
        process.on('SIGTERM', () => void this.shutdown(coordinator, 'SIGTERM'));
    }

    private async shutdown(coordinator: Coordinator, signal: string): Promise<void> {
        this.logger?.info({ signal }, 'shutting down');
        await coordinator.close();
        process.exit(0);
    }

    private closeDatabase(database: CoordinatorDatabase): void {
        const [, closeError] = attempt(() => database.close());
        if (closeError) {
            this.logger?.warn({ error: this.describe(closeError) }, 'database close failed');
        }
    }

    private fail(message: string): void {
        console.error(message);
        process.exit(1);
    }

    private describe(error: unknown): string {
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
    }
}

const [, mainError] = await attemptAsync(() => new CoordinatorMain().run());
if (mainError) {
    console.error(ConfigErrorFormatter.format(mainError));
    process.exit(1);
}

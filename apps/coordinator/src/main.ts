import path from 'node:path';
import {
    ConfigErrorFormatter,
    ConfigLoader,
    HardwareProbe,
    LayaRuntimeResolver,
    LoggerFactory,
    PlannerSecretsLoader,
    attempt,
    attemptAsync,
} from '@ticrafter/core';
import { MigrationRunner, SchemaVersionRegistry, SqliteRuntime } from '@ticrafter/memory';
import type { Logger } from 'pino';
import { Coordinator, EpochStore, type CoordinatorDatabase } from './core/index.js';

export class CoordinatorMain {
    private logger: Logger | null = null;

    async run(): Promise<void> {
        const [config, configError] = new ConfigLoader().load();
        if (configError) return this.fail(ConfigErrorFormatter.format(configError));
        if (config === null) return this.fail('configuration returned null');

        const logger = new LoggerFactory().create('coordinator', config.logging.level);
        this.logger = logger;
        const cwd = process.cwd();
        const dataDir = path.resolve(cwd, config.dataDir);
        const [db, dbError] = new SqliteRuntime({ dataDir }).open();
        if (dbError) return this.fail(this.describe(dbError));
        if (db === null) return this.fail('database returned null');

        const [, migrationError] = new MigrationRunner(db).run();
        if (migrationError) {
            this.closeDatabase(db);
            return this.fail(this.describe(migrationError));
        }

        const [schemaVersion, versionError] = new SchemaVersionRegistry(db).current();
        if (versionError) {
            this.closeDatabase(db);
            return this.fail(this.describe(versionError));
        }
        if (schemaVersion === null) {
            this.closeDatabase(db);
            return this.fail('schema version returned null');
        }

        const [epoch, epochError] = new EpochStore(db).bump();
        if (epochError) {
            this.closeDatabase(db);
            return this.fail(this.describe(epochError));
        }
        if (epoch === null) {
            this.closeDatabase(db);
            return this.fail('epoch returned null');
        }

        const [planner, plannerError] = new PlannerSecretsLoader(config).load();
        if (plannerError) {
            this.closeDatabase(db);
            return this.fail(ConfigErrorFormatter.format(plannerError));
        }
        if (planner === null) {
            this.closeDatabase(db);
            return this.fail('planner secrets returned null');
        }

        const hardware = new HardwareProbe().probe();
        const laya = LayaRuntimeResolver.resolve(config);
        logger.info({ epoch, dataDir, schemaVersion, hardware }, 'coordinator starting');
        logger.info(
            {
                laya,
                plannerEnabled: config.planner.enabled,
                plannerConfigured: Boolean(planner.baseUrl),
            },
            'runtime resolved',
        );

        const coordinator = new Coordinator({
            config,
            logger,
            db,
            epoch,
            schemaVersion,
            hardware,
            laya,
            planner,
            dataDir,
            cwd,
        });
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

    private closeDatabase(db: CoordinatorDatabase): void {
        const [, closeError] = attempt(() => db.close());
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

import path from 'node:path';

import {
    attempt,
    attemptAsync,
    ConfigErrorFormatter,
    ConfigLoader,
    type LoggerFactoryPort,
    type LoggerPort,
    MessageSchemaRegistry,
    NamePoolValidator,
    type Result,
    type TicrafterConfig,
} from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime, SqliteSkillCheckpointStore } from '@ticrafter/memory';
import { EmergencyStopController } from '@ticrafter/safety';
import { MemoryCheckpointStore, type SkillCheckpointStore } from '@ticrafter/skills';

import { BotConnection } from './bot-connection.js';
import { ReconnectSupervisor } from './reconnect-supervisor.js';
import { SqliteCheckpointStore } from './sqlite-checkpoint-store.js';

type CheckpointDatabase = NonNullable<ReturnType<SqliteRuntime['open']>[0]>;

export interface BotHandle {
    botId: string;
    name: string;
    close: () => void;
}

export interface StartBotOptions {
    botIndex?: number;
}

export interface BotRuntimeOptions extends StartBotOptions {
    configLoader: ConfigLoader;
    loggerFactory: LoggerFactoryPort;
}

export class BotRuntime {
    private readonly reconnect = new ReconnectSupervisor();
    private readonly emergencyStop = new EmergencyStopController();
    private closed = false;
    private activeConnection: BotConnection | null = null;
    private logger: LoggerPort | null = null;
    private database: CheckpointDatabase | null = null;

    constructor(private readonly options: BotRuntimeOptions) {}

    async start(): Promise<Result<BotHandle, string>> {
        const [config, configError] = this.options.configLoader.load();
        if (configError) return [null, ConfigErrorFormatter.format(configError)];
        if (config === null) return [null, 'configuration returned null'];

        const botIndex = this.options.botIndex ?? Number.parseInt(process.env.BOT_INDEX ?? '0', 10);
        const [name, nameError] = NamePoolValidator.nameFor(config.botNames, botIndex);
        if (nameError) return [null, ConfigErrorFormatter.format(nameError)];
        if (name === null) return [null, 'bot name returned null'];

        const botId = `bot.${name.toLowerCase()}`;
        const logger = this.options.loggerFactory.create(`bot:${name}`, config.logging.level);
        this.logger = logger;
        const checkpointStore = this.openCheckpointStore(config, logger);
        const registry = MessageSchemaRegistry.withDefaults();
        const url = `ws://${config.transport.host}:${config.transport.port}`;

        void attemptAsync(() =>
            this.loop(config, name, botId, url, registry, logger, checkpointStore),
        ).then(([, loopError]) => {
            if (loopError) {
                logger.error({ error: this.describe(loopError) }, 'bot loop failed');
            }
        });

        return [
            {
                botId,
                name,
                close: () => this.close(),
            },
            null,
        ];
    }

    private async loop(
        config: TicrafterConfig,
        name: string,
        botId: string,
        url: string,
        registry: MessageSchemaRegistry,
        logger: LoggerPort,
        checkpointStore: SkillCheckpointStore,
    ): Promise<void> {
        while (!this.closed) {
            const [spawned, connectionError] = await this.connectOnce(
                config,
                name,
                botId,
                url,
                registry,
                logger,
                checkpointStore,
            );
            if (connectionError) {
                logger.warn({ error: connectionError }, 'bot connection failed');
            }
            if (spawned) this.reconnect.reset();
            if (this.closed) break;

            const delay = this.reconnect.nextDelay();
            logger.info({ delay }, 'reconnecting bot');
            await this.sleep(delay);
        }
    }

    private async connectOnce(
        config: TicrafterConfig,
        name: string,
        botId: string,
        url: string,
        registry: MessageSchemaRegistry,
        logger: LoggerPort,
        checkpointStore: SkillCheckpointStore,
    ): Promise<Result<boolean, string>> {
        const connection = new BotConnection({
            config,
            name,
            botId,
            url,
            registry,
            logger,
            emergencyStop: this.emergencyStop,
            checkpointStore,
        });
        this.activeConnection = connection;
        const [spawned, connectionError] = await connection.run();
        this.activeConnection = null;
        return [spawned, connectionError];
    }

    private openCheckpointStore(config: TicrafterConfig, logger: LoggerPort): SkillCheckpointStore {
        const dataDirectory = path.resolve(process.cwd(), config.dataDir);
        const [database, openError] = new SqliteRuntime({ dataDir: dataDirectory }).open();
        if (openError) {
            logger.warn(
                { error: openError },
                'checkpoint database open failed; using memory store',
            );
            return new MemoryCheckpointStore();
        }
        if (database === null) {
            logger.warn('checkpoint database open returned null; using memory store');
            return new MemoryCheckpointStore();
        }

        this.database = database;
        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) {
            logger.warn(
                { error: migrationError },
                'checkpoint database migration failed; using memory store',
            );
            this.closeDatabase();
            return new MemoryCheckpointStore();
        }

        return new SqliteCheckpointStore(new SqliteSkillCheckpointStore(database));
    }

    private sleep(milliseconds: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    }

    private close(): void {
        this.closed = true;
        this.reconnect.cancel();
        this.activeConnection?.close();
        this.activeConnection = null;
        this.closeDatabase();
        this.logger?.info('bot runtime closed');
    }

    private closeDatabase(): void {
        const database = this.database;
        this.database = null;
        if (database === null) return;
        const [, closeError] = attempt(() => database.close());
        if (closeError) {
            this.logger?.warn(
                { error: this.describe(closeError) },
                'checkpoint database close failed',
            );
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

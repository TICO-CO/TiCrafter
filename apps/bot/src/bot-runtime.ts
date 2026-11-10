import {
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

import { ActionExecutor } from './action-executor.js';
import { BotConnection } from './bot-connection.js';
import { GuardianHook } from './guardian.js';
import { ReconnectSupervisor } from './reconnect-supervisor.js';

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
    private closed = false;
    private activeConnection: BotConnection | null = null;
    private logger: LoggerPort | null = null;

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
        const registry = MessageSchemaRegistry.withDefaults();
        const url = `ws://${config.transport.host}:${config.transport.port}`;
        const executor = new ActionExecutor(new GuardianHook(), logger);

        void attemptAsync(() =>
            this.loop(config, name, botId, url, registry, executor, logger),
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
        executor: ActionExecutor,
        logger: LoggerPort,
    ): Promise<void> {
        while (!this.closed) {
            const [spawned, connectionError] = await this.connectOnce(
                config,
                name,
                botId,
                url,
                registry,
                executor,
                logger,
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
        executor: ActionExecutor,
        logger: LoggerPort,
    ): Promise<Result<boolean, string>> {
        const connection = new BotConnection({
            config,
            name,
            botId,
            url,
            registry,
            executor,
            logger,
        });
        this.activeConnection = connection;
        const [spawned, connectionError] = await connection.run();
        this.activeConnection = null;
        return [spawned, connectionError];
    }

    private sleep(milliseconds: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    }

    private close(): void {
        this.closed = true;
        this.reconnect.cancel();
        this.activeConnection?.close();
        this.activeConnection = null;
        this.logger?.info('bot runtime closed');
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

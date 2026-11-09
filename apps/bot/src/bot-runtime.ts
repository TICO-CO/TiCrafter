import {
    BotTransportClient,
    ConfigErrorFormatter,
    ConfigLoader,
    LoggerFactory,
    MessageSchemaRegistry,
    NamePoolValidator,
    attempt,
    attemptAsync,
    type Result,
    type TicrafterConfig,
} from '@ticrafter/core';
import { createBot, type Bot } from 'mineflayer';
import type { Logger } from 'pino';
import { ActionExecutor } from './action-executor.js';
import { BotEventBridge } from './event-bridge.js';
import { GuardianHook } from './guardian.js';
import { ReconnectSupervisor } from './reconnect-supervisor.js';
import { StateDigest } from './state-digest.js';
import { WorldCacheAdapter } from './world-cache.js';

export interface BotHandle {
    botId: string;
    name: string;
    close: () => void;
}

export interface StartBotOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    botIndex?: number;
}

export class BotRuntime {
    private readonly reconnect = new ReconnectSupervisor();
    private closed = false;
    private activeBot: Bot | null = null;
    private activeTransport: BotTransportClient | null = null;
    private world: WorldCacheAdapter | null = null;
    private logger: Logger | null = null;

    constructor(private readonly options: StartBotOptions = {}) {}

    async start(): Promise<Result<BotHandle, string>> {
        const [config, configError] = new ConfigLoader({
            cwd: this.options.cwd,
            env: this.options.env,
        }).load();
        if (configError) return [null, ConfigErrorFormatter.format(configError)];
        if (config === null) return [null, 'configuration returned null'];

        const index = this.options.botIndex ?? Number.parseInt(process.env.BOT_INDEX ?? '0', 10);
        const [name, nameError] = NamePoolValidator.nameFor(config.botNames, index);
        if (nameError) return [null, ConfigErrorFormatter.format(nameError)];
        if (name === null) return [null, 'bot name returned null'];

        const botId = `bot.${name.toLowerCase()}`;
        const logger = new LoggerFactory().create(`bot:${name}`, config.logging.level);
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
        logger: Logger,
    ): Promise<void> {
        while (!this.closed) {
            const [spawned, connectError] = await this.connectOnce(
                config,
                name,
                botId,
                url,
                registry,
                executor,
                logger,
            );
            if (connectError) {
                logger.warn({ error: connectError }, 'bot connection failed');
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
        logger: Logger,
    ): Promise<Result<boolean, string>> {
        const transport = new BotTransportClient({ url, registry });
        const [connected, connectError] = await transport.connect();
        if (connectError) return [null, this.describe(connectError)];
        if (connected === null) return [null, 'transport connect returned null'];

        this.activeTransport = transport;
        const [hello, helloError] = await transport.hello(botId, name);
        if (helloError) {
            transport.close();
            return [null, this.describe(helloError)];
        }
        if (hello === null) {
            transport.close();
            return [null, 'session hello returned null'];
        }
        if (!hello.accepted) {
            transport.close();
            return [null, hello.reason ?? 'coordinator rejected session'];
        }
        logger.info({ epoch: hello.epoch }, 'coordinator accepted session');

        const [bot, botError] = attempt<Bot>(() =>
            createBot({
                host: config.lan.host,
                port: config.lan.port,
                username: name,
                auth: 'offline',
            }),
        );
        if (botError || bot === null) {
            transport.close();
            return [null, `mineflayer failed: ${this.describe(botError)}`];
        }
        this.activeBot = bot;
        this.world = new WorldCacheAdapter(bot);

        const bridge = new BotEventBridge(
            bot,
            (event) => transport.sendEvent('bot.event', { botId, ...event }),
            logger,
        );
        bridge.attach();

        let spawned = false;
        bot.once('spawn', () => {
            spawned = true;
            logger.info({ name }, 'bot spawned');
        });
        bot.once('login', () => {
            spawned = true;
            logger.info({ name }, 'bot logged in');
        });

        const heartbeat = setInterval(
            () => this.sendHeartbeat(transport, bot, botId, logger),
            1000,
        );
        const [, actionError] = executor.execute({ type: 'idle' });
        if (actionError) logger.debug({ error: actionError }, 'idle action rejected');

        await this.waitForEnd(bot, name, logger);

        clearInterval(heartbeat);
        bridge.detachAll();
        transport.close();
        this.activeBot = null;
        this.activeTransport = null;
        this.world = null;
        return [spawned, null];
    }

    private sendHeartbeat(
        transport: BotTransportClient,
        bot: Bot,
        botId: string,
        logger: Logger,
    ): void {
        const [, sendError] = transport.sendEvent('bot.heartbeat', {
            botId,
            at: new Date().toISOString(),
            digest: StateDigest.collect(bot),
        });
        if (sendError) {
            logger.debug({ error: this.describe(sendError) }, 'heartbeat send failed');
        }
    }

    private waitForEnd(bot: Bot, name: string, logger: Logger): Promise<void> {
        return new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };
            bot.once('end', (reason) => {
                logger.warn({ name, reason }, 'mineflayer connection ended');
                finish();
            });
            bot.once('error', (error) => {
                logger.warn({ name, error: error.message }, 'mineflayer error');
                finish();
            });
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    private close(): void {
        this.closed = true;
        this.reconnect.cancel();
        const [, quitError] = attempt(() => this.activeBot?.quit());
        if (quitError) {
            this.logger?.warn({ error: this.describe(quitError) }, 'mineflayer quit failed');
        }
        this.activeTransport?.close();
    }

    private describe(error: unknown): string {
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
    }
}

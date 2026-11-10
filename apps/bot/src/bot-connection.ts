import {
    attempt,
    BLOCK_UPDATE_EVENT,
    EventStream,
    type LoggerPort,
    type MessageSchemaRegistry,
    type Result,
    type TicrafterConfig,
} from '@ticrafter/core';
import { BlockUpdateListener, PerceptionRateLimiter, RingSampler } from '@ticrafter/perception';
import { type Bot, createBot } from 'mineflayer';

import type { ActionExecutor } from './action-executor.js';
import { BotEventBridge } from './event-bridge.js';
import { PerceptionHost } from './perception-host.js';
import { MineflayerPerceptionSource } from './perception-source.js';
import { StateDigest } from './state-digest.js';
import { BotTransportClient } from './transport/index.js';
import { WorldCacheAdapter } from './world-cache.js';

export interface BotConnectionOptions {
    config: TicrafterConfig;
    name: string;
    botId: string;
    url: string;
    registry: MessageSchemaRegistry;
    executor: ActionExecutor;
    logger: LoggerPort;
}

interface BlockLike {
    name?: string;
    boundingBox?: string;
    position?: { x: number; y: number; z: number };
    getProperties?: () => Record<string, string | number | boolean>;
}

export class BotConnection {
    private bot: Bot | null = null;
    private transport: BotTransportClient | null = null;
    private world: WorldCacheAdapter | null = null;
    private perception: PerceptionHost | null = null;

    constructor(private readonly options: BotConnectionOptions) {}

    async run(): Promise<Result<boolean, string>> {
        const transport = new BotTransportClient({
            url: this.options.url,
            registry: this.options.registry,
        });
        const [connected, connectError] = await transport.connect();
        if (connectError) return [null, this.describe(connectError)];
        if (connected === null) return [null, 'transport connect returned null'];

        this.transport = transport;
        const [hello, helloError] = await transport.hello(this.options.botId, this.options.name);
        if (helloError) {
            this.closeTransport();
            return [null, this.describe(helloError)];
        }
        if (hello === null) {
            this.closeTransport();
            return [null, 'session hello returned null'];
        }
        if (!hello.accepted) {
            this.closeTransport();
            return [null, hello.reason ?? 'coordinator rejected session'];
        }
        this.options.logger.info({ epoch: hello.epoch }, 'coordinator accepted session');

        const [bot, botError] = attempt<Bot>(() =>
            createBot({
                host: this.options.config.lan.host,
                port: this.options.config.lan.port,
                username: this.options.name,
                auth: 'offline',
            }),
        );
        if (botError || bot === null) {
            this.closeTransport();
            return [null, `mineflayer failed: ${this.describe(botError)}`];
        }
        this.bot = bot;
        this.world = new WorldCacheAdapter(bot);

        const blockUpdates = new BlockUpdateListener();
        const bridge = new BotEventBridge(
            bot,
            (event) => transport.sendEvent('bot.event', { botId: this.options.botId, ...event }),
            this.options.logger,
            (block) => this.forwardBlockUpdate(block, blockUpdates, transport),
        );
        bridge.attach();
        this.startPerception(bot, transport);

        let spawned = false;
        bot.once('spawn', () => {
            spawned = true;
            this.options.logger.info({ name: this.options.name }, 'bot spawned');
        });
        bot.once('login', () => {
            spawned = true;
            this.options.logger.info({ name: this.options.name }, 'bot logged in');
        });

        const heartbeat = setInterval(() => this.sendHeartbeat(), 1000);
        const [, actionError] = this.options.executor.execute({ type: 'idle' });
        if (actionError) {
            this.options.logger.debug({ error: actionError }, 'idle action rejected');
        }

        await this.waitForEnd();

        clearInterval(heartbeat);
        this.perception?.stop();
        this.perception = null;
        bridge.detachAll();
        this.closeTransport();
        this.bot = null;
        this.world = null;
        return [spawned, null];
    }

    close(): void {
        this.perception?.stop();
        this.perception = null;
        const [, quitError] = attempt(() => this.bot?.quit());
        if (quitError) {
            this.options.logger.warn({ error: this.describe(quitError) }, 'mineflayer quit failed');
        }
        this.closeTransport();
        this.bot = null;
        this.world = null;
    }

    private forwardBlockUpdate(
        block: unknown,
        listener: BlockUpdateListener,
        transport: BotTransportClient,
    ): void {
        const candidate = block as BlockLike | null;
        if (
            candidate === null ||
            candidate.name === undefined ||
            candidate.position === undefined
        ) {
            return;
        }
        const properties = candidate.getProperties?.();
        const [observation, observeError] = listener.observe(
            this.options.botId,
            {
                position: {
                    x: Math.floor(candidate.position.x),
                    y: Math.floor(candidate.position.y),
                    z: Math.floor(candidate.position.z),
                },
                blockId: candidate.name,
                solid: candidate.boundingBox === 'block',
                ...(properties === undefined
                    ? {}
                    : {
                          properties: Object.fromEntries(
                              Object.entries(properties).map(([key, value]) => [
                                  key,
                                  String(value),
                              ]),
                          ) as Record<string, string>,
                      }),
            },
            new Date().toISOString(),
        );
        if (observeError) {
            this.options.logger.warn({ error: observeError }, 'block update rejected');
            return;
        }
        if (observation === null) return;
        const [, sendError] = transport.sendEvent(BLOCK_UPDATE_EVENT, {
            botId: observation.botId,
            chunk: observation.chunk,
            observedAt: observation.observedAt,
            block: observation.block,
        });
        if (sendError) {
            this.options.logger.warn({ error: sendError }, 'block update send failed');
        }
    }

    private startPerception(bot: Bot, transport: BotTransportClient): void {
        const config = this.options.config.perception;
        const [limiter, limiterError] = PerceptionRateLimiter.create(
            {
                tokensPerSecond: config.chunksPerSecond,
                burst: config.burst,
            },
            () => Date.now(),
        );
        if (limiterError || limiter === null) {
            this.options.logger.error(
                { error: limiterError },
                'perception rate limiter creation failed',
            );
            return;
        }
        const [sampler, samplerError] = RingSampler.create(
            { ringRadius: config.ringRadius },
            limiter,
        );
        if (samplerError || sampler === null) {
            this.options.logger.error(
                { error: samplerError },
                'perception ring sampler creation failed',
            );
            return;
        }
        const events = new EventStream();
        this.perception = new PerceptionHost({
            botId: this.options.botId,
            source: new MineflayerPerceptionSource(bot),
            sampler,
            events,
            sink: (envelope) => transport.send(envelope),
            logger: this.options.logger,
            ringRadius: config.ringRadius,
            intervalMilliseconds: 1000,
            maxChunksPerTick: Math.max(1, Math.ceil(config.chunksPerSecond)),
        });
        this.perception.start();
    }

    private sendHeartbeat(): void {
        if (!this.bot || !this.transport) return;
        const [, sendError] = this.transport.sendEvent('bot.heartbeat', {
            botId: this.options.botId,
            at: new Date().toISOString(),
            digest: StateDigest.collect(this.bot),
        });
        if (sendError) {
            this.options.logger.debug({ error: this.describe(sendError) }, 'heartbeat send failed');
        }
    }

    private waitForEnd(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this.bot) {
                resolve();
                return;
            }
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };
            this.bot.once('end', (reason) => {
                this.options.logger.warn(
                    { name: this.options.name, reason },
                    'mineflayer connection ended',
                );
                finish();
            });
            this.bot.once('error', (error) => {
                this.options.logger.warn(
                    { name: this.options.name, error: error.message },
                    'mineflayer error',
                );
                finish();
            });
        });
    }

    private closeTransport(): void {
        if (!this.transport) return;
        const [, closeError] = this.transport.close();
        if (closeError) {
            this.options.logger.warn(
                { error: this.describe(closeError) },
                'transport close failed',
            );
        }
        this.transport = null;
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

import {
    ProtocolEnvelope,
    SessionAuthenticator,
    TransportServer,
    attempt,
    type ClientConnection,
    type Envelope,
    type HardwareReport,
    type LayaRuntime,
    MessageSchemaRegistry,
    type PlannerSecrets,
    type Result,
    type TicrafterConfig,
    type TransportFailure,
} from '@ticrafter/core';
import { EventLogWriter } from '@ticrafter/memory';
import type { Logger } from 'pino';
import { BotProcessSupervisor } from './bot-process-supervisor.js';
import { CommandRouter } from './command-router.js';
import type { CoordinatorDatabase } from './epoch.js';
import { OpsServer, type OpsStatus } from './ops-server.js';
import { RestartRecovery } from './recovery.js';
import { Scheduler } from './scheduler.js';
import { SessionManager } from './session-manager.js';

export interface CoordinatorOptions {
    config: TicrafterConfig;
    logger: Logger;
    db: CoordinatorDatabase;
    epoch: number;
    schemaVersion: number;
    hardware: HardwareReport;
    laya: LayaRuntime;
    planner: PlannerSecrets;
    dataDir: string;
    cwd: string;
}

export class Coordinator {
    private readonly sessions = new SessionManager();
    private readonly registry: MessageSchemaRegistry = MessageSchemaRegistry.withDefaults();
    private readonly events: EventLogWriter;
    private readonly transport: TransportServer;
    private readonly router: CommandRouter;
    private readonly ops: OpsServer;
    private readonly scheduler: Scheduler;
    private readonly recovery: RestartRecovery;
    private readonly supervisor: BotProcessSupervisor | null;

    constructor(private readonly options: CoordinatorOptions) {
        this.events = new EventLogWriter(options.db);
        this.transport = new TransportServer({
            host: options.config.transport.host,
            port: options.config.transport.port,
            registry: this.registry,
            logger: options.logger,
            onMessage: (connection, envelope) => this.handleMessage(connection, envelope),
            onClose: (connection) => this.handleClose(connection),
        });
        this.router = new CommandRouter({
            epoch: options.epoch,
            sessions: this.sessions,
            transport: this.transport,
            logger: options.logger,
        });
        this.ops = new OpsServer({
            host: options.config.ops.host,
            port: options.config.ops.port,
            logger: options.logger,
            status: () => this.status(),
        });
        this.scheduler = new Scheduler({
            intervalMs: 5000,
            logger: options.logger,
            tick: () => this.pruneSessions(),
        });
        this.recovery = new RestartRecovery(options.db);
        this.supervisor = options.config.autoSpawnBots
            ? new BotProcessSupervisor({
                  root: options.cwd,
                  botCount: options.config.botCount,
                  logger: options.logger,
              })
            : null;
    }

    async start(): Promise<Result<void, string>> {
        const [transportStarted, transportError] = await this.transport.start();
        if (transportError) return [null, this.describe(transportError)];
        if (transportStarted === null) return [null, 'transport start returned null'];

        const [opsStarted, opsError] = await this.ops.start();
        if (opsError) return [null, opsError.message];
        if (opsStarted === null) return [null, 'ops server start returned null'];

        this.scheduler.start();
        this.supervisor?.spawnAll();
        this.runRecovery();

        this.options.logger.info(
            { host: this.options.config.transport.host, port: this.options.config.transport.port },
            'transport listening',
        );
        return [undefined, null];
    }

    async close(): Promise<void> {
        this.scheduler.stop();
        this.supervisor?.stopAll();
        await this.transport.close();
        await this.ops.close();
        const [, closeError] = attempt(() => this.options.db.close());
        if (closeError) {
            this.options.logger.warn({ error: this.describe(closeError) }, 'database close failed');
        }
        this.options.logger.info('coordinator stopped');
    }

    get epoch(): number {
        return this.options.epoch;
    }

    get config(): TicrafterConfig {
        return this.options.config;
    }

    get logger(): Logger {
        return this.options.logger;
    }

    get db(): CoordinatorDatabase {
        return this.options.db;
    }

    private handleMessage(connection: ClientConnection, envelope: Envelope): void {
        if (envelope.kind === 'request' && envelope.type === 'session.hello') {
            this.handleHello(connection, envelope);
            return;
        }
        if (!connection.botId) {
            this.options.logger.warn(
                { connectionId: connection.id },
                'message before session hello',
            );
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.heartbeat') {
            this.sessions.touch(connection.botId);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.event') {
            this.options.logger.debug({ botId: connection.botId, event: envelope.payload }, 'bot event');
            return;
        }
        if (envelope.kind === 'request') {
            const [, routeError] = this.router.handle(connection, envelope);
            if (routeError) {
                this.options.logger.warn(
                    { error: routeError, type: envelope.type },
                    'command routing failed',
                );
            }
        }
    }

    private handleHello(connection: ClientConnection, request: Envelope): void {
        const [bot, authError] = SessionAuthenticator.authenticate(
            request.payload,
            this.options.config.botNames,
        );
        if (authError || bot === null) {
            const message = authError ? this.failureMessage(authError) : 'authentication failed';
            this.rejectHello(connection, request, message);
            return;
        }
        this.acceptHello(connection, request, bot);
    }

    private acceptHello(
        connection: ClientConnection,
        request: Envelope,
        bot: { botId: string; name: string },
    ): void {
        if (connection.botId) this.sessions.remove(connection.botId);
        connection.botId = bot.botId;
        connection.name = bot.name;
        const now = new Date().toISOString();
        this.sessions.add({
            botId: bot.botId,
            name: bot.name,
            connectionId: connection.id,
            connectedAt: now,
            lastSeen: now,
        });
        const [, logError] = this.events.append({
            botId: bot.botId,
            type: 'session.joined',
            payload: { name: bot.name },
        });
        if (logError) {
            this.options.logger.warn({ error: this.describe(logError) }, 'session join log failed');
        }
        this.sendEnvelope(
            connection,
            ProtocolEnvelope.create(
                'response',
                'session.hello.response',
                { accepted: true, epoch: this.options.epoch },
                { replyTo: request.id },
            ),
        );
        this.options.logger.info(
            { botId: bot.botId, name: bot.name, epoch: this.options.epoch },
            'bot session accepted',
        );
    }

    private rejectHello(connection: ClientConnection, request: Envelope, message: string): void {
        this.sendEnvelope(
            connection,
            ProtocolEnvelope.create(
                'response',
                'session.hello.response',
                { accepted: false, epoch: this.options.epoch, reason: message },
                { replyTo: request.id, error: { code: 'auth_failed', message } },
            ),
        );
        this.options.logger.warn(
            { connectionId: connection.id, error: message },
            'bot session rejected',
        );
        const [, closeError] = attempt(() => connection.socket.close());
        if (closeError) {
            this.options.logger.debug(
                { connectionId: connection.id, error: this.describe(closeError) },
                'socket close failed',
            );
        }
    }

    private handleClose(connection: ClientConnection): void {
        if (!connection.botId) return;
        const [, logError] = this.events.append({
            botId: connection.botId,
            type: 'session.left',
            payload: {},
        });
        if (logError) {
            this.options.logger.warn({ error: this.describe(logError) }, 'session leave log failed');
        }
        this.sessions.remove(connection.botId);
    }

    private sendEnvelope(connection: ClientConnection, envelope: Envelope): void {
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) {
            this.options.logger.warn(
                { error: sendError, type: envelope.type },
                'transport send failed',
            );
        }
    }

    private pruneSessions(): void {
        const stale = this.sessions.pruneStale(15_000);
        if (stale.length) this.options.logger.warn({ stale }, 'pruned stale sessions');
    }

    private runRecovery(): void {
        const [report, recoveryError] = this.recovery.run();
        if (recoveryError) {
            this.options.logger.warn(
                { error: this.describe(recoveryError) },
                'restart recovery failed',
            );
            return;
        }
        if (report) this.options.logger.info(report, 'restart recovery complete');
    }

    private status(): OpsStatus {
        return {
            ok: true,
            epoch: this.options.epoch,
            uptimeSeconds: Math.round(process.uptime()),
            sessions: this.sessions.count(),
            schemaVersion: this.options.schemaVersion,
        };
    }

    private failureMessage(failure: TransportFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

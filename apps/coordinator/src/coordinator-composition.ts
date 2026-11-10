import { type LoggerPort, MessageSchemaRegistry, type TicrafterConfig } from '@ticrafter/core';
import { EventLogWriter } from '@ticrafter/memory';

import {
    BotProcessSupervisor,
    CommandRouter,
    Coordinator,
    type CoordinatorDatabase,
    MessageRouter,
    OpsServer,
    RestartRecovery,
    Scheduler,
    SessionHandshake,
    SessionManager,
} from './core/index.js';
import { TransportServer } from './transport/index.js';
import { CoordinatorWorldModel } from './world-model.js';

export interface CoordinatorCompositionOptions {
    config: TicrafterConfig;
    logger: LoggerPort;
    database: CoordinatorDatabase;
    epoch: number;
    schemaVersion: number;
    currentWorkingDirectory: string;
}

export class CoordinatorComposition {
    static build(options: CoordinatorCompositionOptions): Coordinator {
        const sessions = new SessionManager();
        const registry = MessageSchemaRegistry.withDefaults();
        const events = new EventLogWriter(options.database);
        const worldModel = new CoordinatorWorldModel(options.database, options.logger);
        let messageRouter: MessageRouter | null = null;
        const transport = new TransportServer({
            host: options.config.transport.host,
            port: options.config.transport.port,
            registry,
            logger: options.logger,
            onMessage: (connection, envelope) => messageRouter?.handleMessage(connection, envelope),
            onClose: (connection) => messageRouter?.handleClose(connection),
        });
        const router = new CommandRouter({
            epoch: options.epoch,
            sessions,
            transport,
            logger: options.logger,
        });
        const handshake = new SessionHandshake({
            epoch: options.epoch,
            botNames: options.config.botNames,
            sessions,
            events,
            transport,
            logger: options.logger,
        });
        messageRouter = new MessageRouter({
            sessions,
            router,
            handshake,
            events,
            logger: options.logger,
            onChunkSnapshot: (payload) => {
                const [, ingestError] = worldModel.ingestChunk(payload);
                if (ingestError) {
                    options.logger.warn(
                        { error: ingestError, chunk: payload.chunk },
                        'chunk snapshot ingestion failed',
                    );
                }
            },
            onLandmarkCandidate: (payload) => {
                const [, ingestError] = worldModel.ingestLandmark(payload);
                if (ingestError) {
                    options.logger.warn(
                        { error: ingestError, type: payload.candidate.type },
                        'landmark candidate ingestion failed',
                    );
                }
            },
        });
        const ops = new OpsServer({
            host: options.config.ops.host,
            port: options.config.ops.port,
            logger: options.logger,
            status: () => ({
                ok: true,
                epoch: options.epoch,
                uptimeSeconds: Math.round(process.uptime()),
                sessions: sessions.count(),
                schemaVersion: options.schemaVersion,
            }),
        });
        const scheduler = new Scheduler({
            intervalMs: 5000,
            logger: options.logger,
            tick: () => {
                const staleSessions = sessions.pruneStale(15_000);
                if (staleSessions.length) {
                    options.logger.warn({ staleSessions }, 'pruned stale sessions');
                }
            },
        });
        const recovery = new RestartRecovery(options.database);
        const supervisor = options.config.autoSpawnBots
            ? new BotProcessSupervisor({
                  root: options.currentWorkingDirectory,
                  botCount: options.config.botCount,
                  logger: options.logger,
              })
            : null;

        return new Coordinator({
            config: options.config,
            logger: options.logger,
            database: options.database,
            epoch: options.epoch,
            schemaVersion: options.schemaVersion,
            transport,
            messageRouter,
            ops,
            scheduler,
            recovery,
            supervisor,
        });
    }
}

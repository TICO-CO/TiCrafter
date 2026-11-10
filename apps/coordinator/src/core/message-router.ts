import type { Envelope, LoggerPort } from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { ClientConnection } from '../transport/index.js';
import type { CommandRouter } from './command-router.js';
import type { SessionHandshake } from './session-handshake.js';
import type { SessionManager } from './session-manager.js';

export interface MessageRouterOptions {
    sessions: SessionManager;
    router: CommandRouter;
    handshake: SessionHandshake;
    events: EventLogWriter;
    logger: LoggerPort;
}

export class MessageRouter {
    constructor(private readonly options: MessageRouterOptions) {}

    handleMessage(connection: ClientConnection, envelope: Envelope): void {
        if (envelope.kind === 'request' && envelope.type === 'session.hello') {
            this.options.handshake.handle(connection, envelope);
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
            this.options.sessions.touch(connection.botId);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.event') {
            this.options.logger.debug(
                { botId: connection.botId, event: envelope.payload },
                'bot event',
            );
            return;
        }
        if (envelope.kind === 'request') {
            const [, routeError] = this.options.router.handle(connection, envelope);
            if (routeError) {
                this.options.logger.warn(
                    { error: routeError, type: envelope.type },
                    'command routing failed',
                );
            }
        }
    }

    handleClose(connection: ClientConnection): void {
        if (!connection.botId) return;
        const [, logError] = this.options.events.append({
            botId: connection.botId,
            type: 'session.left',
            payload: {},
        });
        if (logError) {
            this.options.logger.warn(
                { error: this.describe(logError) },
                'session leave log failed',
            );
        }
        this.options.sessions.remove(connection.botId);
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

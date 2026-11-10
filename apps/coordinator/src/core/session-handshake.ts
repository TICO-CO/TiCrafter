import {
    attempt,
    type AuthenticatedBot,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    SessionAuthenticator,
    type TransportFailure,
} from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { SessionManager } from './session-manager.js';

export interface SessionHandshakeOptions {
    epoch: number;
    botNames: string[];
    sessions: SessionManager;
    events: EventLogWriter;
    transport: TransportServer;
    logger: LoggerPort;
}

export class SessionHandshake {
    constructor(private readonly options: SessionHandshakeOptions) {}

    handle(connection: ClientConnection, request: Envelope): void {
        const [bot, authenticationError] = SessionAuthenticator.authenticate(
            request.payload,
            this.options.botNames,
        );
        if (authenticationError || bot === null) {
            const message = authenticationError
                ? this.failureMessage(authenticationError)
                : 'authentication failed';
            this.reject(connection, request, message);
            return;
        }

        this.accept(connection, request, bot);
    }

    private accept(connection: ClientConnection, request: Envelope, bot: AuthenticatedBot): void {
        if (connection.botId) this.options.sessions.remove(connection.botId);
        connection.botId = bot.botId;
        connection.name = bot.name;
        const now = new Date().toISOString();
        this.options.sessions.add({
            botId: bot.botId,
            name: bot.name,
            connectionId: connection.id,
            connectedAt: now,
            lastSeen: now,
        });
        const [, logError] = this.options.events.append({
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

    private reject(connection: ClientConnection, request: Envelope, message: string): void {
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

    private sendEnvelope(connection: ClientConnection, envelope: Envelope): void {
        const [, sendError] = this.options.transport.send(connection, envelope);
        if (sendError) {
            this.options.logger.warn(
                { error: sendError, type: envelope.type },
                'transport send failed',
            );
        }
    }

    private failureMessage(failure: TransportFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

import {
    ProtocolEnvelope,
    type ClientConnection,
    type Envelope,
    type Result,
    type TransportFailure,
    type TransportServer,
} from '@ticrafter/core';
import type { Logger } from 'pino';
import { SessionManager } from './session-manager.js';

export interface CommandRouterOptions {
    epoch: number;
    sessions: SessionManager;
    transport: TransportServer;
    logger: Logger;
}

export class CommandRouter {
    constructor(private readonly options: CommandRouterOptions) {}

    handle(connection: ClientConnection, envelope: Envelope): Result<void, TransportFailure> {
        if (envelope.kind !== 'request') return [undefined, null];
        switch (envelope.type) {
            case 'coordinator.ping':
                return this.respond(connection, envelope, 'coordinator.ping.response', {
                    pong: true,
                    at: new Date().toISOString(),
                });
            case 'coordinator.status':
                return this.respond(connection, envelope, 'coordinator.status.response', {
                    epoch: this.options.epoch,
                    sessions: this.options.sessions.list().map((session) => ({
                        botId: session.botId,
                        name: session.name,
                        connectedAt: session.connectedAt,
                        lastSeen: session.lastSeen,
                    })),
                });
            default:
                return this.respondError(
                    connection,
                    envelope,
                    'unknown_request',
                    `unknown request type: ${envelope.type}`,
                );
        }
    }

    private respond(
        connection: ClientConnection,
        request: Envelope,
        type: string,
        payload: unknown,
    ): Result<void, TransportFailure> {
        const envelope = ProtocolEnvelope.create('response', type, payload, {
            replyTo: request.id,
        });
        return this.send(connection, envelope);
    }

    private respondError(
        connection: ClientConnection,
        request: Envelope,
        code: string,
        message: string,
    ): Result<void, TransportFailure> {
        const envelope = ProtocolEnvelope.create(
            'response',
            'coordinator.error',
            { code, message },
            { replyTo: request.id, error: { code, message } },
        );
        return this.send(connection, envelope);
    }

    private send(connection: ClientConnection, envelope: Envelope): Result<void, TransportFailure> {
        const [sent, sendError] = this.options.transport.send(connection, envelope);
        if (sendError) {
            this.options.logger.warn(
                { error: sendError, type: envelope.type },
                'command response failed',
            );
        }
        return [sent, sendError];
    }
}

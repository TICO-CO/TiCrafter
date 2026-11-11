import {
    attempt,
    attemptAsync,
    type Envelope,
    type Result,
    type TransportFailure,
    WsCodec,
} from '@ticrafter/core';
import { WebSocket, WebSocketServer } from 'ws';

import type { ClientConnection, TransportServerOptions } from './types.js';

export class TransportServer {
    private readonly wss: WebSocketServer;
    private readonly codec: WsCodec;
    private readonly clients = new Map<WebSocket, ClientConnection>();

    constructor(private readonly options: TransportServerOptions) {
        this.codec = new WsCodec(options.registry);
        this.wss = new WebSocketServer({ host: options.host, port: options.port });
        this.wss.on('connection', (socket) => this.handleConnection(socket));
    }

    async start(): Promise<Result<void, TransportFailure>> {
        const [started, startError] = await attemptAsync<void, TransportFailure>(
            () =>
                new Promise<void>((resolve, reject) => {
                    this.wss.once('listening', () => resolve());
                    this.wss.once('error', (error) =>
                        reject({
                            type: 'LISTEN_FAILED',
                            message: error.message,
                        } satisfies TransportFailure),
                    );
                }),
        );
        if (startError) return [null, startError];
        if (started === null) {
            return [null, { type: 'LISTEN_FAILED', message: 'server returned null' }];
        }

        return [undefined, null];
    }

    send(connection: ClientConnection, envelope: Envelope): Result<void, TransportFailure> {
        if (connection.socket.readyState !== WebSocket.OPEN) {
            return [null, { type: 'NOT_CONNECTED' }];
        }

        const [encoded, encodeError] = this.codec.encode(envelope);
        if (encodeError) return [null, encodeError];
        if (encoded === null) {
            return [null, { type: 'INVALID_FRAME', message: 'encoded envelope missing' }];
        }

        const [, sendError] = attempt(() => connection.socket.send(encoded));
        if (sendError) {
            return [null, { type: 'SEND_FAILED', message: this.describe(sendError) }];
        }

        return [undefined, null];
    }

    broadcast(envelope: Envelope): Result<void, TransportFailure> {
        for (const connection of this.clients.values()) {
            const [, sendError] = this.send(connection, envelope);
            if (sendError) return [null, sendError];
        }

        return [undefined, null];
    }

    list(): ClientConnection[] {
        return [...this.clients.values()];
    }

    isListening(): boolean {
        return this.wss.address() !== null;
    }

    async close(): Promise<Result<void, TransportFailure>> {
        const [, closeError] = await attemptAsync<void, TransportFailure>(
            () =>
                new Promise<void>((resolve) => {
                    this.wss.close(() => resolve());
                }),
        );
        if (closeError) {
            return [null, { type: 'DISCONNECTED', message: this.describe(closeError) }];
        }

        return [undefined, null];
    }

    private handleConnection(socket: WebSocket): void {
        const now = new Date().toISOString();
        const connection: ClientConnection = {
            id: crypto.randomUUID(),
            socket,
            connectedAt: now,
            lastSeen: now,
        };
        this.clients.set(socket, connection);
        this.options.logger.info({ connectionId: connection.id }, 'client connected');

        socket.on('message', (data) => this.handleMessage(connection, data));
        socket.on('close', () => this.handleClose(connection));
        socket.on('error', (error) => {
            this.options.logger.warn(
                { connectionId: connection.id, error: error.message },
                'client socket error',
            );
        });
    }

    private handleMessage(connection: ClientConnection, data: unknown): void {
        const [envelope, decodeError] = this.codec.decode(data as Buffer);
        if (decodeError || envelope === null) {
            this.options.logger.warn(
                {
                    connectionId: connection.id,
                    error: this.describeFailure(decodeError),
                },
                'invalid frame',
            );
            return;
        }

        connection.lastSeen = new Date().toISOString();
        this.options.onMessage(connection, envelope);
    }

    private handleClose(connection: ClientConnection): void {
        this.clients.delete(connection.socket);
        this.options.onClose(connection);
        this.options.logger.info({ connectionId: connection.id }, 'client disconnected');
    }

    private describeFailure(failure: TransportFailure | null): string {
        if (failure === null) return 'unknown transport failure';
        return 'message' in failure ? failure.message : failure.type;
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

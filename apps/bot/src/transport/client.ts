import {
    attempt,
    type Envelope,
    type MessageSchemaRegistry,
    ProtocolEnvelope,
    RequestCorrelator,
    type Result,
    type SessionHelloResponse,
    sessionHelloResponseSchema,
    type TransportFailure,
    WsCodec,
} from '@ticrafter/core';
import { WebSocket } from 'ws';

export interface BotTransportClientOptions {
    url: string;
    registry: MessageSchemaRegistry;
}

export class BotTransportClient {
    private readonly codec: WsCodec;
    private readonly correlator = new RequestCorrelator();
    private readonly listeners = new Set<(envelope: Envelope) => void>();
    private socket: WebSocket | null = null;

    constructor(private readonly options: BotTransportClientOptions) {
        this.codec = new WsCodec(options.registry);
    }

    connect(): Promise<Result<void, TransportFailure>> {
        const [socket, socketError] = attempt(() => new WebSocket(this.options.url));
        if (socketError || socket === null) {
            return Promise.resolve([null, this.connectFailure(socketError)]);
        }

        this.socket = socket;
        return new Promise((resolve) => {
            socket.once('open', () => resolve([undefined, null]));
            socket.once('error', (error) => {
                resolve([null, { type: 'CONNECT_FAILED', message: error.message }]);
            });
            socket.on('close', () => {
                this.correlator.rejectAll({
                    type: 'DISCONNECTED',
                    message: 'transport disconnected',
                });
            });
            socket.on('message', (data) => this.handleMessage(data));
        });
    }

    async hello(
        botId: string,
        name: string,
    ): Promise<Result<SessionHelloResponse, TransportFailure>> {
        const [response, requestError] = await this.request('session.hello', {
            botId,
            name,
            version: '0.1.0',
        });
        if (requestError) return [null, requestError];
        if (response === null) {
            return [null, { type: 'INVALID_FRAME', message: 'hello response missing' }];
        }

        const parsed = sessionHelloResponseSchema.safeParse(response.payload);
        if (!parsed.success) {
            return [
                null,
                {
                    type: 'INVALID_PAYLOAD',
                    messageType: response.type,
                    message: parsed.error.message,
                },
            ];
        }

        return [parsed.data, null];
    }

    async request(
        type: string,
        payload: unknown,
        timeoutMs = 5000,
    ): Promise<Result<Envelope, TransportFailure>> {
        const { envelope, response } = this.correlator.createRequest(type, payload, timeoutMs);
        const [, sendError] = this.send(envelope);
        if (sendError) {
            this.correlator.reject(envelope.id, sendError);
        }

        return response;
    }

    sendEvent(type: string, payload: unknown): Result<void, TransportFailure> {
        return this.send(ProtocolEnvelope.create('event', type, payload));
    }

    send(envelope: Envelope): Result<void, TransportFailure> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return [null, { type: 'NOT_CONNECTED' }];
        }

        const [encoded, encodeError] = this.codec.encode(envelope);
        if (encodeError) return [null, encodeError];
        if (encoded === null) {
            return [null, { type: 'INVALID_FRAME', message: 'encoded envelope missing' }];
        }

        const [, sendError] = attempt(() => this.socket?.send(encoded));
        if (sendError) {
            return [null, { type: 'SEND_FAILED', message: this.describe(sendError) }];
        }

        return [undefined, null];
    }

    onMessage(listener: (envelope: Envelope) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    close(): Result<void, TransportFailure> {
        this.correlator.rejectAll({ type: 'DISCONNECTED', message: 'transport closed' });
        const [, closeError] = attempt(() => this.socket?.close());
        this.socket = null;
        if (closeError) {
            return [null, { type: 'DISCONNECTED', message: this.describe(closeError) }];
        }

        return [undefined, null];
    }

    private handleMessage(data: unknown): void {
        const [envelope, decodeError] = this.codec.decode(data as Buffer);
        if (decodeError || envelope === null) return;
        if (this.correlator.accept(envelope)) return;
        this.listeners.forEach((listener) => listener(envelope));
    }

    private connectFailure(error: unknown): TransportFailure {
        return { type: 'CONNECT_FAILED', message: this.describe(error) };
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

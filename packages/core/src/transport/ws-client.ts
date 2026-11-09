import { WebSocket } from 'ws';
import { WsCodec } from './codec';
import {
  createEnvelope,
  type Envelope,
  type MessageSchemaRegistry,
  type SessionHelloResponse,
} from './messages';
import { RequestCorrelator } from './request-correlator';

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

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.url);
      this.socket = socket;

      socket.once('open', () => resolve());
      socket.once('error', (error) => reject(error));
      socket.on('close', () => this.correlator.rejectAll(new Error('transport disconnected')));
      socket.on('message', (data) => {
        let envelope: Envelope;
        try {
          envelope = this.codec.decode(data as Buffer);
        } catch {
          return;
        }
        if (this.correlator.accept(envelope)) return;
        for (const listener of this.listeners) listener(envelope);
      });
    });
  }

  async hello(botId: string, name: string): Promise<SessionHelloResponse> {
    const response = await this.request('session.hello', { botId, name, version: '0.1.0' });
    return response.payload as SessionHelloResponse;
  }

  async request(type: string, payload: unknown, timeoutMs = 5000): Promise<Envelope> {
    const { envelope, response } = this.correlator.createRequest(type, payload, timeoutMs);
    this.send(envelope);
    return response;
  }

  sendEvent(type: string, payload: unknown): void {
    this.send(createEnvelope('event', type, payload));
  }

  send(envelope: Envelope): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
      throw new Error('transport is not connected');
    this.socket.send(this.codec.encode(envelope));
  }

  onMessage(listener: (envelope: Envelope) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.correlator.rejectAll(new Error('transport closed'));
    this.socket?.close();
    this.socket = null;
  }
}

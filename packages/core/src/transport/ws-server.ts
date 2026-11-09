import { WebSocketServer, WebSocket } from 'ws';
import type { Logger } from 'pino';
import { WsCodec } from './codec';
import type { Envelope, MessageSchemaRegistry } from './messages';

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  botId?: string;
  name?: string;
  connectedAt: string;
  lastSeen: string;
}

export interface TransportServerOptions {
  host: string;
  port: number;
  registry: MessageSchemaRegistry;
  logger: Logger;
  onMessage: (connection: ClientConnection, envelope: Envelope) => void;
  onClose: (connection: ClientConnection) => void;
}

export class TransportServer {
  private readonly wss: WebSocketServer;
  private readonly codec: WsCodec;
  private readonly clients = new Map<WebSocket, ClientConnection>();

  constructor(private readonly options: TransportServerOptions) {
    this.codec = new WsCodec(options.registry);
    this.wss = new WebSocketServer({ host: options.host, port: options.port });
    this.wss.on('connection', (socket) => this.handleConnection(socket));
  }

  private handleConnection(socket: WebSocket): void {
    const now = new Date().toISOString();
    const connection: ClientConnection = { id: crypto.randomUUID(), socket, connectedAt: now, lastSeen: now };
    this.clients.set(socket, connection);
    this.options.logger.info({ connectionId: connection.id }, 'client connected');

    socket.on('message', (data) => {
      try {
        const envelope = this.codec.decode(data as Buffer);
        connection.lastSeen = new Date().toISOString();
        this.options.onMessage(connection, envelope);
      } catch (error) {
        this.options.logger.warn(
          { connectionId: connection.id, error: error instanceof Error ? error.message : String(error) },
          'invalid frame',
        );
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      this.options.onClose(connection);
      this.options.logger.info({ connectionId: connection.id }, 'client disconnected');
    });

    socket.on('error', (error) => {
      this.options.logger.warn({ connectionId: connection.id, error: error.message }, 'client socket error');
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.once('listening', () => resolve());
      this.wss.once('error', reject);
    });
  }

  send(connection: ClientConnection, envelope: Envelope): void {
    if (connection.socket.readyState !== WebSocket.OPEN) return;
    connection.socket.send(this.codec.encode(envelope));
  }

  broadcast(envelope: Envelope): void {
    for (const connection of this.clients.values()) this.send(connection, envelope);
  }

  list(): ClientConnection[] {
    return [...this.clients.values()];
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}

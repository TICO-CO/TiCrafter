import type { Envelope, LoggerPort, MessageSchemaRegistry } from '@ticrafter/core';
import type { WebSocket } from 'ws';

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
    logger: LoggerPort;
    onMessage: (connection: ClientConnection, envelope: Envelope) => void;
    onClose: (connection: ClientConnection) => void;
}

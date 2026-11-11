import { attempt, MessageSchemaRegistry } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';
import type { WebSocket } from 'ws';

import { BotTransportClient } from './client.js';

describe('BotTransportClient', () => {
    it('keeps later socket errors handled after a failed connection', async () => {
        const client = new BotTransportClient({
            url: 'ws://127.0.0.1:0',
            registry: MessageSchemaRegistry.withDefaults(),
        });

        const [connected, connectError] = await client.connect();
        expect(connected).toBeNull();
        expect(connectError?.type).toBe('CONNECT_FAILED');

        const socket = (client as unknown as { socket: WebSocket | null }).socket;
        expect(socket).not.toBeNull();
        if (socket === null) return;

        const [, emitError] = attempt(() => socket.emit('error', new Error('late socket failure')));
        expect(emitError).toBeNull();
        client.close();
    });
});

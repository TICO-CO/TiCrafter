import {
    type BotBlueprintResponse,
    type Envelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';
import { afterEach, describe, expect, it } from 'bun:test';
import type { WebSocket } from 'ws';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import type { ClientConnection, TransportServer } from '../transport/index.js';
import { BlueprintCommandHandler } from './blueprint-command-handler.js';
import { BlueprintDocumentService } from './blueprint-document-service.js';
import { BlueprintDocumentRepository } from './blueprint-repository.js';

const now = '2026-11-12T10:00:00.000Z';

class FakeTransport {
    readonly sent: Envelope[] = [];

    send(_connection: ClientConnection, envelope: Envelope): Result<void, TransportFailure> {
        this.sent.push(envelope);
        return [undefined, null];
    }
}

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function connection(botId = 'bot.one'): ClientConnection {
    return {
        id: 'connection-1',
        socket: null as unknown as WebSocket,
        botId,
        name: 'TiBot1',
        connectedAt: now,
        lastSeen: now,
    };
}

const blueprint = {
    id: 'blueprint.home',
    anchor: { x: 0, y: 64, z: 0 },
    rotation: 0 as const,
    blocks: [
        {
            x: 0,
            y: 64,
            z: 0,
            state: { name: 'oak_planks' },
            priority: 0,
        },
    ],
    materials: [{ item: 'oak_planks', count: 1 }],
    constraints: [],
};

describe('BlueprintCommandHandler', () => {
    afterEach(() => CoordinatorTestSupport.cleanup());

    it('returns the exact requested revision', () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const blueprints = new BlueprintDocumentService({
            documents: new BlueprintDocumentRepository(coordinatorDatabase),
        });
        const [document, commitError] = blueprints.commit({
            id: blueprint.id,
            source: 'template',
            provenance: { createdBy: 'bot.one' },
            blueprint,
        });
        expect(commitError).toBeNull();
        expect(document?.revision).toBe(1);

        const transport = new FakeTransport();
        const handler = new BlueprintCommandHandler(
            blueprints,
            transport as unknown as TransportServer,
            logger,
        );
        handler.handleGet(
            connection(),
            { botId: 'bot.one', blueprintId: blueprint.id, revision: 1 },
            { id: 'request-1' } as Envelope,
        );

        const response = transport.sent[0]?.payload as BotBlueprintResponse;
        expect(response.ok).toBe(true);
        expect(response.document?.id).toBe(blueprint.id);
        expect(response.document?.revision).toBe(1);
    });

    it('rejects missing revisions and mismatched bots', () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const blueprints = new BlueprintDocumentService({
            documents: new BlueprintDocumentRepository(coordinatorDatabase),
        });
        blueprints.commit({
            id: blueprint.id,
            source: 'template',
            provenance: { createdBy: 'bot.one' },
            blueprint,
        });
        const transport = new FakeTransport();
        const handler = new BlueprintCommandHandler(
            blueprints,
            transport as unknown as TransportServer,
            logger,
        );

        handler.handleGet(
            connection(),
            { botId: 'bot.one', blueprintId: blueprint.id, revision: 2 },
            { id: 'request-1' } as Envelope,
        );
        handler.handleGet(
            connection('bot.two'),
            { botId: 'bot.one', blueprintId: blueprint.id, revision: 1 },
            { id: 'request-2' } as Envelope,
        );

        const missing = transport.sent[0]?.payload as BotBlueprintResponse;
        const mismatch = transport.sent[1]?.payload as BotBlueprintResponse;
        expect(missing.ok).toBe(false);
        expect(missing.reason?.includes('missing')).toBe(true);
        expect(mismatch.ok).toBe(false);
    });
});

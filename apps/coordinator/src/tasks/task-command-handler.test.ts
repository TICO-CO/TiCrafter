import {
    type BotTaskClaim,
    type BotTaskComplete,
    type BotTaskResponse,
    type Envelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';
import { EventLogWriter, TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';
import type { WebSocket } from 'ws';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import type { ClientConnection, TransportServer } from '../transport/index.js';
import { TaskBoard } from './task-board.js';
import { TaskCommandHandler } from './task-command-handler.js';
import { TaskFixtures } from './task-fixtures.js';

const now = '2026-11-11T10:00:00.000Z';

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

function connection(): ClientConnection {
    return {
        id: 'connection-1',
        socket: null as unknown as WebSocket,
        botId: 'bot.one',
        name: 'TiBot1',
        connectedAt: now,
        lastSeen: now,
    };
}

function claim(): BotTaskClaim {
    return {
        botId: 'bot.one',
        at: now,
        position: { x: 0, y: 64, z: 0 },
        inventory: [],
    };
}

describe('TaskCommandHandler', () => {
    const fresh = (): {
        board: TaskBoard;
        handler: TaskCommandHandler;
        transport: FakeTransport;
    } => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const board = new TaskBoard({
            database: coordinatorDatabase,
            events: new EventLogWriter(coordinatorDatabase),
            transactions: new TransactionManager(coordinatorDatabase),
            world: TaskFixtures.world(),
            claims: TaskFixtures.claims(),
        });
        const transport = new FakeTransport();
        return {
            board,
            transport,
            handler: new TaskCommandHandler(board, transport as unknown as TransportServer, logger),
        };
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('assigns a claimed task with its fencing token', () => {
        const { board, handler, transport } = fresh();
        board.create(TaskFixtures.task({ payload: { skillId: 'navigate' } }), now);

        handler.handleClaim(connection(), claim(), { id: 'request-1' } as Envelope);

        expect(transport.sent).toHaveLength(1);
        const response = transport.sent[0]?.payload as BotTaskResponse;
        expect(response.ok).toBe(true);
        expect(response.task?.id).toBe('task-1');
        expect(response.fencingToken).not.toBeNull();
    });

    it('completes a task only for its current lease holder', () => {
        const { board, handler, transport } = fresh();
        board.create(TaskFixtures.task({ payload: { skillId: 'navigate' } }), now);
        handler.handleClaim(connection(), claim(), { id: 'request-1' } as Envelope);
        const assigned = transport.sent[0]?.payload as BotTaskResponse;
        const token = assigned.fencingToken ?? 0;

        handler.handleComplete(
            connection(),
            {
                botId: 'bot.one',
                taskId: 'task-1',
                fencingToken: token + 1,
            } satisfies BotTaskComplete,
            { id: 'request-2' } as Envelope,
        );
        expect((transport.sent[1]?.payload as BotTaskResponse).ok).toBe(false);

        handler.handleComplete(
            connection(),
            { botId: 'bot.one', taskId: 'task-1', fencingToken: token } satisfies BotTaskComplete,
            { id: 'request-3' } as Envelope,
        );
        expect((transport.sent[2]?.payload as BotTaskResponse).ok).toBe(true);
        expect(board.get('task-1')[0]?.status).toBe('completed');
    });

    it('renews and rejects stale leases', () => {
        const { board, handler, transport } = fresh();
        board.create(TaskFixtures.task({ payload: { skillId: 'navigate' } }), now);
        handler.handleClaim(connection(), claim(), { id: 'request-1' } as Envelope);
        const token = (transport.sent[0]?.payload as BotTaskResponse).fencingToken ?? 0;

        handler.handleRenew(
            connection(),
            { botId: 'bot.one', taskId: 'task-1', fencingToken: token },
            { id: 'request-2' } as Envelope,
        );
        expect((transport.sent[1]?.payload as BotTaskResponse).ok).toBe(true);

        handler.handleRenew(
            connection(),
            { botId: 'bot.one', taskId: 'task-1', fencingToken: token + 1 },
            { id: 'request-3' } as Envelope,
        );
        expect((transport.sent[2]?.payload as BotTaskResponse).ok).toBe(false);
    });
});

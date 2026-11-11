import {
    BLOCK_UPDATE_EVENT,
    type BlockUpdateMessage,
    CHUNK_SNAPSHOT_EVENT,
    type ChunkSnapshotMessage,
    DECISION_REQUEST,
    type DecisionRequest,
    LANDMARK_CANDIDATE_EVENT,
    type LandmarkCandidateMessage,
    type LoggerPort,
    ProtocolEnvelope,
} from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';
import type { WebSocket } from 'ws';

import type { ClientConnection } from '../transport/index.js';
import type { CommandRouter } from './command-router.js';
import { MessageRouter } from './message-router.js';
import type { SessionHandshake } from './session-handshake.js';
import { SessionManager } from './session-manager.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function connection(): ClientConnection {
    return {
        id: 'connection-1',
        socket: null as unknown as WebSocket,
        botId: 'bot.tibot1',
        name: 'TiBot1',
        connectedAt: '2026-11-10T12:00:00.000Z',
        lastSeen: '2026-11-10T12:00:00.000Z',
    };
}

function chunkPayload(): ChunkSnapshotMessage {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        version: 1,
        observedAt: '2026-11-10T12:00:00.000Z',
        blocks: [],
    };
}

function landmarkPayload(): LandmarkCandidateMessage {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        observedAt: '2026-11-10T12:00:00.000Z',
        candidate: {
            detectorId: 'path',
            type: 'path',
            bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 9, y: 65, z: 0 } },
            anchors: [],
            confidence: 0.7,
            evidence: 'corridor',
        },
    };
}

function blockUpdatePayload(): BlockUpdateMessage {
    return {
        botId: 'bot.tibot1',
        chunk: { x: 0, z: 0 },
        observedAt: '2026-11-10T12:00:00.000Z',
        block: {
            position: { x: 1, y: 64, z: 1 },
            blockId: 'stone',
            solid: true,
        },
    };
}

function decisionPayload(): DecisionRequest {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-11T12:00:00.000Z',
        digest: {
            health: 20,
            food: 18,
            position: { x: 0, y: 64, z: 0 },
            inventoryCount: 1,
        },
        affordances: [{ id: 'mine:0', skillId: 'mine', label: 'Mine stone', priority: 1 }],
    };
}

function router(
    received: {
        chunks: ChunkSnapshotMessage[];
        landmarks: LandmarkCandidateMessage[];
        blocks: BlockUpdateMessage[];
        decisions: DecisionRequest[];
    },
    sessions = new SessionManager(),
): MessageRouter {
    return new MessageRouter({
        sessions,
        router: {} as unknown as CommandRouter,
        handshake: {} as unknown as SessionHandshake,
        events: {} as unknown as EventLogWriter,
        logger,
        onChunkSnapshot: (payload) => received.chunks.push(payload),
        onLandmarkCandidate: (payload) => received.landmarks.push(payload),
        onBlockUpdate: (payload) => received.blocks.push(payload),
        onDecisionRequest: (_connection, payload) => received.decisions.push(payload),
    });
}

describe('MessageRouter perception events', () => {
    it('routes validated perception events', () => {
        const received = {
            chunks: [] as ChunkSnapshotMessage[],
            landmarks: [] as LandmarkCandidateMessage[],
            blocks: [] as BlockUpdateMessage[],
            decisions: [] as DecisionRequest[],
        };
        const messageRouter = router(received);
        const client = connection();

        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('event', CHUNK_SNAPSHOT_EVENT, chunkPayload()),
        );
        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('event', LANDMARK_CANDIDATE_EVENT, landmarkPayload()),
        );
        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('event', BLOCK_UPDATE_EVENT, blockUpdatePayload()),
        );

        expect(received.chunks).toHaveLength(1);
        expect(received.landmarks).toHaveLength(1);
        expect(received.blocks).toHaveLength(1);
    });

    it('records heartbeat positions', () => {
        const received = {
            chunks: [] as ChunkSnapshotMessage[],
            landmarks: [] as LandmarkCandidateMessage[],
            blocks: [] as BlockUpdateMessage[],
            decisions: [] as DecisionRequest[],
        };
        const sessions = new SessionManager();
        sessions.add({
            botId: 'bot.tibot1',
            name: 'TiBot1',
            connectionId: 'connection-1',
            connectedAt: '2026-11-10T12:00:00.000Z',
            lastSeen: '2026-11-10T12:00:00.000Z',
            position: null,
        });
        const messageRouter = router(received, sessions);
        const client = connection();

        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('event', 'bot.heartbeat', {
                botId: 'bot.tibot1',
                at: '2026-11-11T12:00:00.000Z',
                digest: {
                    health: 20,
                    food: 18,
                    position: { x: 4, y: -60, z: 7 },
                    inventoryCount: 0,
                },
            }),
        );

        expect(sessions.get('bot.tibot1')?.position).toEqual({ x: 4, y: -60, z: 7 });
    });

    it('routes validated decision requests', () => {
        const received = {
            chunks: [] as ChunkSnapshotMessage[],
            landmarks: [] as LandmarkCandidateMessage[],
            blocks: [] as BlockUpdateMessage[],
            decisions: [] as DecisionRequest[],
        };
        const messageRouter = router(received);
        const client = connection();

        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('request', DECISION_REQUEST, decisionPayload()),
        );

        expect(received.decisions).toHaveLength(1);
        expect(received.decisions[0]?.botId).toBe('bot.tibot1');
    });

    it('rejects malformed decision requests', () => {
        const received = {
            chunks: [] as ChunkSnapshotMessage[],
            landmarks: [] as LandmarkCandidateMessage[],
            blocks: [] as BlockUpdateMessage[],
            decisions: [] as DecisionRequest[],
        };
        const messageRouter = router(received);
        const client = connection();

        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('request', DECISION_REQUEST, { botId: 'bot.tibot1' }),
        );

        expect(received.decisions).toHaveLength(0);
    });

    it('rejects events whose bot id does not match the session', () => {
        const received = {
            chunks: [] as ChunkSnapshotMessage[],
            landmarks: [] as LandmarkCandidateMessage[],
            blocks: [] as BlockUpdateMessage[],
            decisions: [] as DecisionRequest[],
        };
        const messageRouter = router(received);
        const client = connection();
        const payload = { ...chunkPayload(), botId: 'bot.other' };

        messageRouter.handleMessage(
            client,
            ProtocolEnvelope.create('event', CHUNK_SNAPSHOT_EVENT, payload),
        );

        expect(received.chunks).toHaveLength(0);
    });
});

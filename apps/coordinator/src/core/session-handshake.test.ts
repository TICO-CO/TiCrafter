import {
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';
import type { WebSocket } from 'ws';

import type { BotProfile, BotResumePlan } from '../bots/index.js';
import type { ClientConnection, TransportServer } from '../transport/index.js';
import { SessionHandshake } from './session-handshake.js';
import { SessionManager } from './session-manager.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const profile: BotProfile = {
    botId: 'bot.tibot1',
    username: 'TiBot1',
    uuid: 'uuid-1',
    botIndex: 0,
    role: 'builder',
    temporaryRole: null,
    behavior: { riskTolerance: 0.5, workRadius: 32, sociability: 0.5, preferredBaseId: null },
    status: 'offline',
    currentTaskId: null,
    currentSkill: null,
    currentStructureId: null,
    activeClaimIds: [],
    homeStructureId: null,
    relationships: [],
    editGrantIds: [],
    cursors: {
        lastWorldVersion: 0,
        lastSipRevision: 0,
        lastTaskRevision: 0,
        lastGrantRevision: 0,
    },
    createdAt: '2026-11-11T10:00:00.000Z',
    lastSeen: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
};

const plan: BotResumePlan = {
    profile,
    agency: null,
    task: null,
    claims: [],
    grants: [],
    projects: [],
    checkpoint: null,
    delta: { sipRevision: 1, tasks: [], grants: [] },
};

class FakeTransport {
    readonly sent: Envelope[] = [];

    send(_connection: ClientConnection, envelope: Envelope): Result<void, TransportFailure> {
        this.sent.push(envelope);
        return [undefined, null];
    }
}

function connection(): ClientConnection {
    return {
        id: 'connection-1',
        socket: null as unknown as WebSocket,
        connectedAt: '2026-11-11T10:00:00.000Z',
        lastSeen: '2026-11-11T10:00:00.000Z',
    };
}

describe('SessionHandshake safety context', () => {
    it('delivers active claim and claim regions on resume', () => {
        const transport = new FakeTransport();
        const handshake = new SessionHandshake({
            epoch: 1,
            botNames: ['TiBot1'],
            sessions: new SessionManager(),
            events: { append: () => [1, null] } as unknown as EventLogWriter,
            transport: transport as unknown as TransportServer,
            logger,
            bots: {
                authenticate: () => [profile, null],
                markOnline: () => [profile, null],
                resume: () => [plan, null],
            },
            safety: () => [
                {
                    activeClaim: {
                        id: 'claim.self',
                        ownerBotId: 'bot.tibot1',
                        bbox: { min: { x: 0, y: 60, z: 0 }, max: { x: 2, y: 70, z: 2 } },
                        expiresAt: '2026-11-12T10:00:00.000Z',
                    },
                    claims: [],
                    grants: [],
                },
                null,
            ],
        });

        handshake.handle(
            connection(),
            ProtocolEnvelope.create('request', 'session.hello', {
                botId: 'bot.tibot1',
                name: 'TiBot1',
                version: '0.1.0',
            }),
        );

        const response = transport.sent[0]?.payload as {
            resume?: { safety?: { activeClaim?: { id: string } } };
        };
        expect(response.resume?.safety?.activeClaim?.id).toBe('claim.self');
    });
});

describe('SessionHandshake strategic intent', () => {
    it('delivers the merged per-bot intent on resume', () => {
        const transport = new FakeTransport();
        const handshake = new SessionHandshake({
            epoch: 1,
            botNames: ['TiBot1'],
            sessions: new SessionManager(),
            events: { append: () => [1, null] } as unknown as EventLogWriter,
            transport: transport as unknown as TransportServer,
            logger,
            bots: {
                authenticate: () => [profile, null],
                markOnline: () => [profile, null],
                resume: () => [plan, null],
            },
            strategicIntent: (botId) =>
                botId === 'bot.tibot1'
                    ? {
                          planId: 'plan-1',
                          primaryGoal: { kind: 'gather', weight: 0.6 },
                          secondaryGoals: [],
                          constraints: ['prioritize-safety'],
                          perBot: [],
                      }
                    : null,
        });

        handshake.handle(
            connection(),
            ProtocolEnvelope.create('request', 'session.hello', {
                botId: 'bot.tibot1',
                name: 'TiBot1',
                version: '0.1.0',
            }),
        );

        const response = transport.sent[0]?.payload as {
            resume?: { strategicIntent?: { planId: string } | null };
        };
        expect(response.resume?.strategicIntent?.planId).toBe('plan-1');
    });
});

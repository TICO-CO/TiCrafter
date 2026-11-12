import { describe, expect, it } from 'bun:test';

import { SessionAuthenticator } from './auth.js';
import { WsCodec } from './codec.js';
import { DeltaSync } from './delta-sync.js';
import {
    BLOCK_UPDATE_EVENT,
    CHUNK_SNAPSHOT_EVENT,
    DECISION_REQUEST,
    DECISION_RESPONSE,
    LANDMARK_CANDIDATE_EVENT,
} from './event-types.js';
import { FlowController } from './flow-control.js';
import { MessageSchemaRegistry, ProtocolEnvelope } from './messages.js';
import { RequestCorrelator } from './request-correlator.js';
import {
    BOT_AUTONOMY_PAUSE,
    BOT_AUTONOMY_RESUME,
    BOT_SAFETY_RESUME,
    BOT_SAFETY_STOP,
    BOT_SKILL_CANCEL,
    BOT_SKILL_START,
} from './schemas.js';

describe('transport', () => {
    const registry = MessageSchemaRegistry.withDefaults();
    const codec = new WsCodec(registry);

    it('round-trips a valid envelope', () => {
        const envelope = ProtocolEnvelope.create('request', 'coordinator.ping', {});
        const [encoded, encodeError] = codec.encode(envelope);
        expect(encodeError).toBeNull();
        if (encoded === null) return;
        const [decoded, decodeError] = codec.decode(encoded);
        expect(decodeError).toBeNull();
        if (decoded === null) return;
        expect(decoded).toMatchObject({ type: 'coordinator.ping', kind: 'request' });
    });

    it('round-trips a session resume plan', () => {
        const response = ProtocolEnvelope.create('response', 'session.hello.response', {
            accepted: true,
            epoch: 4,
            resume: {
                task: {
                    id: 'task-1',
                    title: 'Build wall',
                    priority: 5,
                    payload: { skillId: 'place-build' },
                    target: { x: 1, y: 64, z: 1 },
                    requiredRole: 'builder',
                },
                fencingToken: 7,
                leaseUntil: '2026-11-11T12:00:30.000Z',
                checkpoint: { step: 2 },
                sipRevision: 9,
            },
        });
        const [encoded, encodeError] = codec.encode(response);
        expect(encodeError).toBeNull();
        if (encoded === null) return;
        const [decoded, decodeError] = codec.decode(encoded);
        expect(decodeError).toBeNull();
        expect(decoded?.payload).toMatchObject({
            accepted: true,
            epoch: 4,
            resume: { fencingToken: 7, sipRevision: 9, checkpoint: { step: 2 } },
        });
    });

    it('rejects unknown message types', () => {
        const envelope = ProtocolEnvelope.create('request', 'unknown.type', {});
        const [encoded, encodeError] = codec.encode(envelope);
        expect(encoded).toBeNull();
        expect(encodeError).toMatchObject({ type: 'UNKNOWN_MESSAGE' });
    });

    it('rejects malformed payloads', () => {
        const envelope = ProtocolEnvelope.create('event', 'bot.heartbeat', { botId: 'bot.alpha' });
        const [encoded, encodeError] = codec.encode(envelope);
        expect(encoded).toBeNull();
        expect(encodeError).toMatchObject({ type: 'INVALID_PAYLOAD' });
    });

    it('round-trips decision requests and responses', () => {
        const decisionRequest = {
            botId: 'bot.alpha',
            at: '2026-11-11T12:00:00.000Z',
            digest: {
                health: 20,
                food: 18,
                position: { x: 0, y: 64, z: 0 },
                inventoryCount: 1,
            },
            affordances: [{ id: 'mine:0', skillId: 'mine', label: 'Mine stone', priority: 1 }],
        };
        const decisionResponse = {
            botId: 'bot.alpha',
            at: '2026-11-11T12:00:00.000Z',
            choiceId: 'mine:0',
            probabilities: { 'mine:0': 0.9 },
            answerConfidence: 0.9,
            danger: false,
            shouldContinue: true,
            latencyMilliseconds: 12,
            source: 'laya',
        };
        const requestEnvelope = ProtocolEnvelope.create(
            'request',
            DECISION_REQUEST,
            decisionRequest,
        );
        const responseEnvelope = ProtocolEnvelope.create(
            'response',
            DECISION_RESPONSE,
            decisionResponse,
            { replyTo: requestEnvelope.id },
        );
        expect(codec.encode(requestEnvelope)[1]).toBeNull();
        expect(codec.encode(responseEnvelope)[1]).toBeNull();
    });

    it('round-trips perception events', () => {
        const position = { x: 0, y: 64, z: 0 };
        const chunk = {
            botId: 'bot.alpha',
            chunk: { x: 0, z: 0 },
            version: 1,
            observedAt: '2026-11-10T12:00:00.000Z',
            blocks: [{ position, blockId: 'stone', solid: true, properties: { axis: 'x' } }],
        };
        const landmark = {
            botId: 'bot.alpha',
            chunk: { x: 0, z: 0 },
            observedAt: '2026-11-10T12:00:00.000Z',
            candidate: {
                detectorId: 'path',
                type: 'path',
                bbox: { min: position, max: { x: 9, y: 65, z: 0 } },
                anchors: [{ name: 'start', position }],
                confidence: 0.7,
                evidence: 'standable corridor',
            },
        };

        const chunkEnvelope = ProtocolEnvelope.create('event', CHUNK_SNAPSHOT_EVENT, chunk);
        const landmarkEnvelope = ProtocolEnvelope.create(
            'event',
            LANDMARK_CANDIDATE_EVENT,
            landmark,
        );
        const blockUpdateEnvelope = ProtocolEnvelope.create('event', BLOCK_UPDATE_EVENT, {
            botId: 'bot.alpha',
            chunk: { x: 0, z: 0 },
            observedAt: '2026-11-10T12:00:00.000Z',
            block: { position, blockId: 'dirt', solid: true },
            attribution: {
                structureId: 'structure.home',
                blueprintId: 'blueprint.home',
                blueprintRevision: 2,
                workPackageId: 'package.walls',
                planId: 'plan.home',
                fencingToken: 5,
                phase: 'walls',
            },
        });
        const [encodedChunk, chunkError] = codec.encode(chunkEnvelope);
        const [encodedLandmark, landmarkError] = codec.encode(landmarkEnvelope);
        const [encodedBlockUpdate, blockUpdateError] = codec.encode(blockUpdateEnvelope);

        expect(chunkError).toBeNull();
        expect(landmarkError).toBeNull();
        expect(blockUpdateError).toBeNull();
        if (encodedChunk === null || encodedLandmark === null || encodedBlockUpdate === null) {
            return;
        }
        const [decodedChunk, chunkDecodeError] = codec.decode(encodedChunk);
        const [decodedLandmark, landmarkDecodeError] = codec.decode(encodedLandmark);
        const [decodedBlockUpdate, blockUpdateDecodeError] = codec.decode(encodedBlockUpdate);

        expect(chunkDecodeError).toBeNull();
        expect(landmarkDecodeError).toBeNull();
        expect(blockUpdateDecodeError).toBeNull();
        expect(decodedChunk?.type).toBe(CHUNK_SNAPSHOT_EVENT);
        expect(decodedLandmark?.type).toBe(LANDMARK_CANDIDATE_EVENT);
        expect(decodedBlockUpdate?.type).toBe(BLOCK_UPDATE_EVENT);
        expect(decodedBlockUpdate?.payload).toMatchObject({
            attribution: {
                structureId: 'structure.home',
                blueprintId: 'blueprint.home',
                blueprintRevision: 2,
                workPackageId: 'package.walls',
                planId: 'plan.home',
                fencingToken: 5,
                phase: 'walls',
            },
        });
    });

    it('round-trips skill commands', () => {
        const start = ProtocolEnvelope.create('request', BOT_SKILL_START, {
            skillId: 'navigate',
            input: { target: { x: 1, y: 64, z: 2 }, range: 2 },
            taskId: 'task-1',
        });
        const cancel = ProtocolEnvelope.create('request', BOT_SKILL_CANCEL, {
            skillId: 'navigate',
            reason: 'coordinator cancelled',
        });
        const [encodedStart, startError] = codec.encode(start);
        const [encodedCancel, cancelError] = codec.encode(cancel);
        expect(startError).toBeNull();
        expect(cancelError).toBeNull();
        if (encodedStart === null || encodedCancel === null) return;
        const [decodedStart, startDecodeError] = codec.decode(encodedStart);
        const [decodedCancel, cancelDecodeError] = codec.decode(encodedCancel);
        expect(startDecodeError).toBeNull();
        expect(cancelDecodeError).toBeNull();
        expect(decodedStart?.type).toBe(BOT_SKILL_START);
        expect(decodedCancel?.type).toBe(BOT_SKILL_CANCEL);
    });

    it('rejects malformed skill commands', () => {
        const missingSkill = ProtocolEnvelope.create('request', BOT_SKILL_START, {
            input: {},
        });
        const invalidInput = ProtocolEnvelope.create('request', BOT_SKILL_START, {
            skillId: 'navigate',
            input: { target: { x: 'far' } },
        });
        const [encodedMissing, missingError] = codec.encode(missingSkill);
        const [encodedInvalid, invalidError] = codec.encode(invalidInput);
        expect(encodedMissing).toBeNull();
        expect(encodedInvalid).toBeNull();
        expect(missingError).toMatchObject({ type: 'INVALID_PAYLOAD' });
        expect(invalidError).toMatchObject({ type: 'INVALID_PAYLOAD' });
    });

    it('round-trips a safety resume command', () => {
        const resume = ProtocolEnvelope.create('request', BOT_SAFETY_RESUME, {
            reason: 'operator cleared emergency stop',
        });
        const [encoded, encodeError] = codec.encode(resume);
        expect(encodeError).toBeNull();
        if (encoded === null) return;
        const [decoded, decodeError] = codec.decode(encoded);
        expect(decodeError).toBeNull();
        expect(decoded?.type).toBe(BOT_SAFETY_RESUME);
        expect(decoded?.payload).toEqual({ reason: 'operator cleared emergency stop' });
    });

    it('authenticates known bot names', () => {
        const [authenticatedBot, authenticationError] = SessionAuthenticator.authenticate(
            { botId: 'bot.tibot1', name: 'TiBot1' },
            ['TiBot1'],
        );
        expect(authenticationError).toBeNull();
        if (authenticatedBot === null) return;
        expect(authenticatedBot).toEqual({ botId: 'bot.tibot1', name: 'TiBot1' });

        const [rejectedBot, rejectionError] = SessionAuthenticator.authenticate(
            { botId: 'bot.unknown', name: 'Unknown' },
            ['TiBot1'],
        );
        expect(rejectedBot).toBeNull();
        expect(rejectionError).toMatchObject({ type: 'AUTH_FAILED' });
    });

    it('times out pending requests', async () => {
        const correlator = new RequestCorrelator();
        const { response } = correlator.createRequest('coordinator.ping', {}, 10);
        const [envelope, timeoutError] = await response;
        expect(envelope).toBeNull();
        expect(timeoutError).toMatchObject({ type: 'TIMEOUT' });
        expect(correlator.size).toBe(0);
    });

    it('settles matching responses', async () => {
        const correlator = new RequestCorrelator();
        const { envelope, response } = correlator.createRequest('coordinator.ping', {}, 1000);
        const reply = ProtocolEnvelope.create(
            'response',
            'coordinator.ping.response',
            { pong: true, at: 'now' },
            { replyTo: envelope.id },
        );
        expect(correlator.accept(reply)).toBe(true);
        const [settledEnvelope, settleError] = await response;
        expect(settleError).toBeNull();
        if (settledEnvelope === null) return;
        expect(settledEnvelope.replyTo).toBe(envelope.id);
    });

    it('rejects a pending request explicitly', async () => {
        const correlator = new RequestCorrelator();
        const { envelope, response } = correlator.createRequest('coordinator.ping', {}, 1000);
        correlator.reject(envelope.id, { type: 'SEND_FAILED', message: 'send failed' });
        const [settledEnvelope, rejectionError] = await response;
        expect(settledEnvelope).toBeNull();
        expect(rejectionError).toMatchObject({ type: 'SEND_FAILED' });
    });

    it('bounds in-flight work and queue depth', () => {
        const flowController = new FlowController({ maxInFlight: 1, maxQueueDepth: 1 });
        expect(flowController.tryAcquire()).toBe(true);
        expect(flowController.tryAcquire()).toBe(false);
        flowController.release();
        expect(flowController.enqueue()).toBe(true);
        expect(flowController.enqueue()).toBe(false);
    });

    it('detects revision drift', () => {
        const localCursor = DeltaSync.initialCursor();
        const remoteCursor = { ...DeltaSync.initialCursor(), sipRevision: 1 };
        expect(DeltaSync.shouldResync(localCursor, remoteCursor)).toBe(true);
        expect(DeltaSync.shouldResync(localCursor, DeltaSync.initialCursor())).toBe(false);
    });

    it('round-trips ops control messages', () => {
        const envelopes = [
            ProtocolEnvelope.create('request', BOT_AUTONOMY_PAUSE, { reason: 'operator pause' }),
            ProtocolEnvelope.create('request', BOT_AUTONOMY_RESUME, { reason: 'operator resume' }),
            ProtocolEnvelope.create('request', BOT_SAFETY_STOP, { reason: 'operator stop' }),
        ];

        envelopes.forEach((envelope) => {
            expect(codec.encode(envelope)[1]).toBeNull();
        });
    });
});

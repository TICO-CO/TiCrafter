import { describe, expect, it } from 'bun:test';

import { SessionAuthenticator } from './auth.js';
import { WsCodec } from './codec.js';
import { DeltaSync } from './delta-sync.js';
import { CHUNK_SNAPSHOT_EVENT, LANDMARK_CANDIDATE_EVENT } from './event-types.js';
import { FlowController } from './flow-control.js';
import { MessageSchemaRegistry, ProtocolEnvelope } from './messages.js';
import { RequestCorrelator } from './request-correlator.js';

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
        const [encodedChunk, chunkError] = codec.encode(chunkEnvelope);
        const [encodedLandmark, landmarkError] = codec.encode(landmarkEnvelope);

        expect(chunkError).toBeNull();
        expect(landmarkError).toBeNull();
        if (encodedChunk === null || encodedLandmark === null) return;
        const [decodedChunk, chunkDecodeError] = codec.decode(encodedChunk);
        const [decodedLandmark, landmarkDecodeError] = codec.decode(encodedLandmark);

        expect(chunkDecodeError).toBeNull();
        expect(landmarkDecodeError).toBeNull();
        expect(decodedChunk?.type).toBe(CHUNK_SNAPSHOT_EVENT);
        expect(decodedLandmark?.type).toBe(LANDMARK_CANDIDATE_EVENT);
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
});

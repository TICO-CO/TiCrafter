import { describe, expect, it } from 'vitest';
import { authenticateHello } from './auth';
import { WsCodec } from './codec';
import { FlowController } from './flow-control';
import { createDefaultRegistry, createEnvelope } from './messages';
import { RequestCorrelator } from './request-correlator';
import { shouldResync, initialCursor } from './delta-sync';

describe('transport', () => {
  const registry = createDefaultRegistry();
  const codec = new WsCodec(registry);

  it('round-trips a valid envelope', () => {
    const envelope = createEnvelope('request', 'coordinator.ping', {});
    expect(codec.decode(codec.encode(envelope))).toMatchObject({ type: 'coordinator.ping', kind: 'request' });
  });

  it('rejects unknown message types', () => {
    const envelope = createEnvelope('request', 'unknown.type', {});
    expect(() => codec.encode(envelope)).toThrow(/unknown message type/);
  });

  it('rejects malformed payloads', () => {
    const envelope = createEnvelope('event', 'bot.heartbeat', { botId: 'bot.x' });
    expect(() => codec.encode(envelope)).toThrow();
  });

  it('authenticates known bot names', () => {
    expect(authenticateHello({ botId: 'bot.tibot1', name: 'TiBot1' }, ['TiBot1'])).toEqual({
      botId: 'bot.tibot1',
      name: 'TiBot1',
    });
    expect(() => authenticateHello({ botId: 'bot.x', name: 'Unknown' }, ['TiBot1'])).toThrow(
      /unknown bot name/,
    );
  });

  it('times out pending requests', async () => {
    const correlator = new RequestCorrelator();
    const { response } = correlator.createRequest('coordinator.ping', {}, 10);
    await expect(response).rejects.toThrow(/timeout/);
    expect(correlator.size).toBe(0);
  });

  it('settles matching responses', async () => {
    const correlator = new RequestCorrelator();
    const { envelope, response } = correlator.createRequest('coordinator.ping', {}, 1000);
    const reply = createEnvelope(
      'response',
      'coordinator.ping.response',
      { pong: true, at: 'now' },
      {
        replyTo: envelope.id,
      },
    );
    expect(correlator.accept(reply)).toBe(true);
    await expect(response).resolves.toMatchObject({ replyTo: envelope.id });
  });

  it('bounds in-flight work and queue depth', () => {
    const flow = new FlowController({ maxInFlight: 1, maxQueueDepth: 1 });
    expect(flow.tryAcquire()).toBe(true);
    expect(flow.tryAcquire()).toBe(false);
    flow.release();
    expect(flow.enqueue()).toBe(true);
    expect(flow.enqueue()).toBe(false);
  });

  it('detects revision drift', () => {
    const local = initialCursor();
    const remote = { ...initialCursor(), sipRevision: 1 };
    expect(shouldResync(local, remote)).toBe(true);
    expect(shouldResync(local, initialCursor())).toBe(false);
  });
});

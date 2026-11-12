import { BlueprintDocumentHash } from '@ticrafter/building';
import type { Envelope, Result, TransportFailure } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { BlueprintFetchClient, type BlueprintRequestPort } from './blueprint-fetch-client.js';

const content = {
    id: 'blueprint.home',
    revision: 3,
    source: 'template' as const,
    provenance: { createdBy: 'bot.one', createdAt: '2026-11-12T10:00:00.000Z' },
    blueprint: {
        id: 'blueprint.home',
        anchor: { x: 0, y: 64, z: 0 },
        rotation: 0 as const,
        blocks: [],
        materials: [],
        constraints: [],
    },
} as const;

const document = {
    ...content,
    hash: BlueprintDocumentHash.of(content),
};

class FakeTransport implements BlueprintRequestPort {
    readonly requests: Array<{ type: string; payload: unknown }> = [];
    response: Envelope | null = null;
    failure: TransportFailure | null = null;

    async request(type: string, payload: unknown): Promise<Result<Envelope, TransportFailure>> {
        this.requests.push({ type, payload });
        if (this.failure !== null) return [null, this.failure];
        return [this.response, null];
    }
}

function response(payload: unknown): Envelope {
    return {
        v: 1,
        id: 'response-1',
        kind: 'response',
        type: 'bot.blueprint.response',
        payload,
        timestamp: '2026-11-12T10:00:00.000Z',
    };
}

describe('BlueprintFetchClient', () => {
    it('fetches an exact revision and caches it', async () => {
        const transport = new FakeTransport();
        transport.response = response({ ok: true, document });
        const client = new BlueprintFetchClient(transport, 'bot.one');

        const [fetched, fetchError] = await client.fetch('blueprint.home', 3);
        expect(fetchError).toBeNull();
        expect(fetched?.revision).toBe(3);
        expect(client.cached('blueprint.home', 3)?.hash).toBe(document.hash);

        const [cached, cachedError] = await client.fetch('blueprint.home', 3);
        expect(cachedError).toBeNull();
        expect(cached?.revision).toBe(3);
        expect(transport.requests).toHaveLength(1);
        expect(transport.requests[0]?.payload).toEqual({
            botId: 'bot.one',
            blueprintId: 'blueprint.home',
            revision: 3,
        });
    });

    it('rejects revision mismatches and failed responses', async () => {
        const transport = new FakeTransport();
        transport.response = response({
            ok: true,
            document: { ...document, revision: 4 },
        });
        const client = new BlueprintFetchClient(transport, 'bot.one');

        const [mismatch, mismatchError] = await client.fetch('blueprint.home', 3);
        expect(mismatch).toBeNull();
        expect(mismatchError).toBe('blueprint response revision mismatch');

        transport.response = response({ ok: false, document: null, reason: 'missing' });
        const [failed, failedError] = await client.fetch('blueprint.other', 1);
        expect(failed).toBeNull();
        expect(failedError).toBe('missing');
    });
});

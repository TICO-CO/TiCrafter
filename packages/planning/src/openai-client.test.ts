import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { OpenAiPlannerClient } from './openai-client.js';
import type { PlannerHttpPort, PlannerHttpRequest, PlannerHttpResponse } from './types.js';

class FakeHttpPort implements PlannerHttpPort {
    constructor(
        private readonly response: Result<PlannerHttpResponse, string>,
        private readonly delayMilliseconds = 0,
    ) {}

    async post(_request: PlannerHttpRequest): Promise<Result<PlannerHttpResponse, string>> {
        if (this.delayMilliseconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.delayMilliseconds));
        }
        return this.response;
    }
}

function client(http: PlannerHttpPort, baseUrl = 'https://planner.invalid'): OpenAiPlannerClient {
    return new OpenAiPlannerClient({
        baseUrl,
        apiKey: 'secret',
        model: 'test-model',
        http,
        timeoutMilliseconds: 100,
    });
}

describe('OpenAiPlannerClient', () => {
    it('posts a chat completion and parses content', async () => {
        const http = new FakeHttpPort([
            {
                status: 200,
                bodyText: JSON.stringify({
                    choices: [{ message: { content: '{"ok":true}' } }],
                    usage: { prompt_tokens: 10, completion_tokens: 5 },
                }),
            },
            null,
        ]);
        const [completion, completionError] = await client(http).complete({
            messages: [{ role: 'user', content: 'plan' }],
            maxOutputTokens: 100,
            signal: new AbortController().signal,
        });
        expect(completionError).toBeNull();
        expect(completion?.content).toBe('{"ok":true}');
        expect(completion?.usage.totalTokens).toBe(15);
    });

    it('rejects a missing endpoint', async () => {
        const http = new FakeHttpPort([{ status: 200, bodyText: '{}' }, null]);
        const [, completionError] = await client(http, '').complete({
            messages: [{ role: 'user', content: 'plan' }],
            maxOutputTokens: 100,
            signal: new AbortController().signal,
        });
        expect(completionError?.type).toBe('MISSING_ENDPOINT');
    });

    it('rejects non-success responses and malformed bodies', async () => {
        const http = new FakeHttpPort([{ status: 500, bodyText: 'failed' }, null]);
        const [, httpError] = await client(http).complete({
            messages: [{ role: 'user', content: 'plan' }],
            maxOutputTokens: 100,
            signal: new AbortController().signal,
        });
        expect(httpError?.type).toBe('HTTP');
        const malformed = new FakeHttpPort([{ status: 200, bodyText: 'not-json' }, null]);
        const [, malformedError] = await client(malformed).complete({
            messages: [{ role: 'user', content: 'plan' }],
            maxOutputTokens: 100,
            signal: new AbortController().signal,
        });
        expect(malformedError?.type).toBe('MALFORMED_RESPONSE');
    });

    it('times out slow responses', async () => {
        const http = new FakeHttpPort(
            [
                {
                    status: 200,
                    bodyText: JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
                },
                null,
            ],
            20,
        );
        const slowClient = new OpenAiPlannerClient({
            baseUrl: 'https://planner.invalid',
            apiKey: 'secret',
            model: 'test-model',
            http,
            timeoutMilliseconds: 1,
        });
        const [, timeoutError] = await slowClient.complete({
            messages: [{ role: 'user', content: 'plan' }],
            maxOutputTokens: 100,
            signal: new AbortController().signal,
        });
        expect(timeoutError?.type).toBe('TRANSPORT');
    });
});

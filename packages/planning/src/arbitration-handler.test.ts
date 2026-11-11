import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { PlannerArbitrationHandler } from './arbitration-handler.js';
import { PlannerBudgetLimiter } from './budget-limiter.js';
import { OpenAiPlannerClient } from './openai-client.js';
import type {
    PlannerArbitrationRequest,
    PlannerHttpPort,
    PlannerHttpRequest,
    PlannerHttpResponse,
} from './types.js';

class FakeHttpPort implements PlannerHttpPort {
    constructor(private readonly content: string) {}

    async post(_request: PlannerHttpRequest): Promise<Result<PlannerHttpResponse, string>> {
        return [
            {
                status: 200,
                bodyText: JSON.stringify({ choices: [{ message: { content: this.content } }] }),
            },
            null,
        ];
    }
}

function handler(content: string): PlannerArbitrationHandler {
    return new PlannerArbitrationHandler({
        client: new OpenAiPlannerClient({
            baseUrl: 'https://planner.invalid',
            apiKey: 'secret',
            model: 'test-model',
            http: new FakeHttpPort(content),
            timeoutMilliseconds: 1_000,
        }),
        budgetLimiter: new PlannerBudgetLimiter({ callsPerMinute: 4, maxTokensPerCall: 20_000 }),
        maxOutputTokens: 1_000,
    });
}

const request: PlannerArbitrationRequest = {
    structureId: 'structure-1',
    requesterBotId: 'bot-2',
    ownerBotIds: ['bot-1'],
    observedDesignRevision: 3,
    designRevision: 3,
    proposedOps: ['place'],
    bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 1, y: 64, z: 1 } },
    intent: 'add a window',
    snapshotRevision: 8,
    completedWorkPackageIds: [],
    claimedWorkPackageIds: [],
    protectedRegion: false,
    noBuildZone: false,
};

describe('PlannerArbitrationHandler', () => {
    it('returns a validated decision', async () => {
        const [decision, decisionError] = await handler(
            '{"allow":true,"reason":"compatible"}',
        ).decide(request, new AbortController().signal);
        expect(decisionError).toBeNull();
        expect(decision?.allow).toBe(true);
    });

    it('rejects malformed decisions', async () => {
        const [decision, decisionError] = await handler('{"allow":"yes"}').decide(
            request,
            new AbortController().signal,
        );
        expect(decision).toBeNull();
        expect(decisionError?.type).toBe('ARBITRATION');
    });
});

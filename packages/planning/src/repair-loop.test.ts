import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { PlannerBudgetLimiter } from './budget-limiter.js';
import { OpenAiPlannerClient } from './openai-client.js';
import { plannerContext, plannerPlan } from './planning-fixture.js';
import { PlannerRepairLoop } from './repair-loop.js';
import { PlannerSchemaValidator } from './schema-validator.js';
import { PlannerSemanticValidator } from './semantic-validator.js';
import type {
    PlannerHttpPort,
    PlannerHttpRequest,
    PlannerHttpResponse,
    PlannerPrompt,
} from './types.js';

class SequenceHttpPort implements PlannerHttpPort {
    private index = 0;

    constructor(private readonly contents: readonly string[]) {}

    async post(_request: PlannerHttpRequest): Promise<Result<PlannerHttpResponse, string>> {
        const content = this.contents[this.index] ?? this.contents[this.contents.length - 1] ?? '';
        this.index += 1;
        return [
            {
                status: 200,
                bodyText: JSON.stringify({ choices: [{ message: { content } }] }),
            },
            null,
        ];
    }
}

function prompt(): PlannerPrompt {
    return {
        context: plannerContext(),
        messages: [{ role: 'user', content: 'plan' }],
        contextHash: 'hash',
    };
}

function repairLoop(contents: readonly string[], maxRepairAttempts = 2): PlannerRepairLoop {
    return new PlannerRepairLoop({
        client: new OpenAiPlannerClient({
            baseUrl: 'https://planner.invalid',
            apiKey: 'secret',
            model: 'test-model',
            sessionId: 'ses_test',
            http: new SequenceHttpPort(contents),
            timeoutMilliseconds: 1_000,
        }),
        schemaValidator: new PlannerSchemaValidator(),
        semanticValidator: new PlannerSemanticValidator({
            skills: { has: (skillId) => skillId === 'navigate' },
            sip: { validate: () => [undefined, null] },
        }),
        budgetLimiter: new PlannerBudgetLimiter({
            callsPerMinute: 10,
            maxTokensPerCall: 20_000,
        }),
        maxRepairAttempts,
        maxOutputTokens: 2_000,
    });
}

describe('PlannerRepairLoop', () => {
    it('accepts a valid first response', async () => {
        const loop = repairLoop([JSON.stringify(plannerPlan())]);
        const [outcome, outcomeError] = await loop.run(
            prompt(),
            plannerContext(),
            new AbortController().signal,
        );
        expect(outcomeError).toBeNull();
        expect(outcome?.attempts).toBe(1);
    });

    it('repairs invalid output', async () => {
        const loop = repairLoop(['{}', JSON.stringify(plannerPlan())]);
        const [outcome, outcomeError] = await loop.run(
            prompt(),
            plannerContext(),
            new AbortController().signal,
        );
        expect(outcomeError).toBeNull();
        expect(outcome?.attempts).toBe(2);
    });

    it('exhausts bounded repair attempts', async () => {
        const loop = repairLoop(['{}', '{}', '{}'], 2);
        const [outcome, outcomeError] = await loop.run(
            prompt(),
            plannerContext(),
            new AbortController().signal,
        );
        expect(outcome).toBeNull();
        expect(outcomeError?.type).toBe('REPAIR_EXHAUSTED');
        if (outcomeError?.type !== 'REPAIR_EXHAUSTED') return;
        expect(outcomeError.attempts).toBe(3);
    });
});

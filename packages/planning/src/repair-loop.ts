import type { Result } from '@ticrafter/core';

import type { PlannerBudgetLimiter } from './budget-limiter.js';
import type { PlannerFailure } from './failures.js';
import type { OpenAiPlannerClient } from './openai-client.js';
import type { PlannerSchemaValidator } from './schema-validator.js';
import type { PlannerSemanticValidator } from './semantic-validator.js';
import type {
    PlannerChatMessage,
    PlannerContext,
    PlannerPrompt,
    PlannerRawResponse,
    PlannerRepairOutcome,
    PlannerUsage,
} from './types.js';

export interface PlannerRepairLoopOptions {
    client: OpenAiPlannerClient;
    schemaValidator: PlannerSchemaValidator;
    semanticValidator: PlannerSemanticValidator;
    budgetLimiter: PlannerBudgetLimiter;
    maxRepairAttempts: number;
    maxOutputTokens: number;
}

export class PlannerRepairLoop {
    constructor(private readonly options: PlannerRepairLoopOptions) {}

    async run(
        prompt: PlannerPrompt,
        context: PlannerContext,
        signal: AbortSignal,
    ): Promise<Result<PlannerRepairOutcome, PlannerFailure>> {
        const messages: PlannerChatMessage[] = [...prompt.messages];
        const responses: PlannerRawResponse[] = [];
        let usage: PlannerUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        let lastFailure: PlannerFailure | null = null;
        for (let attempt = 0; attempt <= this.options.maxRepairAttempts; attempt += 1) {
            const estimate = messages.reduce(
                (total, message) => total + Math.ceil(message.content.length / 4),
                0,
            );
            const [permit, budgetError] = this.options.budgetLimiter.reserve(estimate);
            if (budgetError) return [null, budgetError];
            if (permit === null) {
                return [null, { type: 'TRANSPORT', message: 'budget permit missing' }];
            }
            const [completion, completionError] = await this.options.client.complete({
                messages,
                maxOutputTokens: this.options.maxOutputTokens,
                signal,
            });
            if (completionError) {
                this.options.budgetLimiter.release(permit);
                responses.push({ content: '', failure: completionError, usage });
                return [null, completionError];
            }
            if (completion === null) {
                this.options.budgetLimiter.release(permit);
                return [null, { type: 'MALFORMED_RESPONSE', message: 'completion missing' }];
            }
            this.options.budgetLimiter.settle(permit, completion.usage);
            usage = PlannerRepairLoop.addUsage(usage, completion.usage);
            const [plan, planError] = this.options.schemaValidator.validate(completion.content);
            const [, semanticError] =
                planError === null && plan !== null
                    ? this.options.semanticValidator.validate(plan, context)
                    : [null, planError];
            if (semanticError === null && plan !== null) {
                responses.push({
                    content: completion.content,
                    failure: null,
                    usage: completion.usage,
                });
                return [{ plan, attempts: attempt + 1, responses, usage }, null];
            }
            lastFailure = semanticError ?? {
                type: 'SEMANTIC',
                issues: ['planner validation returned no plan'],
            };
            responses.push({
                content: completion.content,
                failure: lastFailure,
                usage: completion.usage,
            });
            if (attempt >= this.options.maxRepairAttempts) break;
            messages.push({ role: 'assistant', content: completion.content });
            messages.push({
                role: 'user',
                content: `Repair the plan. Return strict JSON only. Fix: ${PlannerRepairLoop.issues(lastFailure)}`,
            });
        }
        return [
            null,
            {
                type: 'REPAIR_EXHAUSTED',
                attempts: this.options.maxRepairAttempts + 1,
                failure: lastFailure ?? {
                    type: 'SCHEMA',
                    issues: ['repair loop produced no result'],
                },
            },
        ];
    }

    private static addUsage(total: PlannerUsage, usage: PlannerUsage): PlannerUsage {
        return {
            inputTokens: total.inputTokens + usage.inputTokens,
            outputTokens: total.outputTokens + usage.outputTokens,
            totalTokens: total.totalTokens + usage.totalTokens,
        };
    }

    private static issues(failure: PlannerFailure): string {
        switch (failure.type) {
            case 'SCHEMA':
            case 'SEMANTIC':
                return failure.issues.join('; ');
            case 'REPAIR_EXHAUSTED':
                return PlannerRepairLoop.issues(failure.failure);
            case 'BUDGET':
            case 'CACHE':
            case 'CONTEXT':
            case 'TRANSPORT':
            case 'HTTP':
            case 'MALFORMED_RESPONSE':
            case 'MISSING_ENDPOINT':
            case 'DISABLED':
            case 'TRANSLATION':
            case 'ARBITRATION':
                return failure.type;
        }
    }
}

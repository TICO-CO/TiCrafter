import { attempt, type Result } from '@ticrafter/core';

import type { PlannerBudgetLimiter } from './budget-limiter.js';
import type { PlannerFailure } from './failures.js';
import type { OpenAiPlannerClient } from './openai-client.js';
import { plannerArbitrationSchema } from './plan-schema.js';
import type {
    PlannerArbitrationRequest,
    PlannerArbitrationResult,
    PlannerChatMessage,
} from './types.js';

export interface PlannerArbitrationHandlerOptions {
    client: OpenAiPlannerClient;
    budgetLimiter: PlannerBudgetLimiter;
    maxOutputTokens: number;
}

export class PlannerArbitrationHandler {
    constructor(private readonly options: PlannerArbitrationHandlerOptions) {}

    async decide(
        request: PlannerArbitrationRequest,
        signal: AbortSignal,
    ): Promise<Result<PlannerArbitrationResult, PlannerFailure>> {
        const messages: readonly PlannerChatMessage[] = [
            {
                role: 'system',
                content:
                    'You arbitrate one Minecraft edit compatibility request. Return strict JSON only: {"allow": boolean, "reason": string}. Safety rules and grants always win. Deny anything that could undo completed work, collide with active work, or violate a protected region or no-build zone.',
            },
            { role: 'user', content: JSON.stringify(request) },
        ];
        const estimate = messages.reduce(
            (total, message) => total + Math.ceil(message.content.length / 4),
            0,
        );
        const [permit, budgetError] = this.options.budgetLimiter.reserve(estimate);
        if (budgetError) return [null, budgetError];
        if (permit === null) {
            return [null, { type: 'ARBITRATION', message: 'budget permit missing' }];
        }
        const [completion, completionError] = await this.options.client.complete({
            messages,
            maxOutputTokens: this.options.maxOutputTokens,
            signal,
        });
        if (completionError) {
            this.options.budgetLimiter.release(permit);
            return [null, completionError];
        }
        if (completion === null) {
            this.options.budgetLimiter.release(permit);
            return [null, { type: 'ARBITRATION', message: 'arbitration completion missing' }];
        }
        this.options.budgetLimiter.settle(permit, completion.usage);
        const [decoded, decodeError] = attempt(() => JSON.parse(completion.content) as unknown);
        if (decodeError) {
            return [null, { type: 'ARBITRATION', message: 'arbitration response is not JSON' }];
        }
        const parsed = plannerArbitrationSchema.safeParse(decoded);
        if (!parsed.success) {
            return [null, { type: 'ARBITRATION', message: parsed.error.message }];
        }
        return [parsed.data, null];
    }
}

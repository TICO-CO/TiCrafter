import { attempt, type Result } from '@ticrafter/core';
import { z as zod } from 'zod';

import type { PlannerFailure } from './failures.js';
import type {
    PlannerCompletion,
    PlannerCompletionRequest,
    PlannerHttpPort,
    PlannerUsage,
} from './types.js';

const completionResponseSchema = zod.object({
    choices: zod
        .array(
            zod.object({
                message: zod.object({ content: zod.string() }),
            }),
        )
        .min(1),
    usage: zod
        .object({
            prompt_tokens: zod.number().int().nonnegative().optional(),
            completion_tokens: zod.number().int().nonnegative().optional(),
        })
        .optional(),
});

export interface OpenAiPlannerClientOptions {
    baseUrl: string;
    apiKey: string;
    model: string;
    http: PlannerHttpPort;
    timeoutMilliseconds: number;
    now?: () => number;
}

export class OpenAiPlannerClient {
    constructor(private readonly options: OpenAiPlannerClientOptions) {}

    async complete(
        request: PlannerCompletionRequest,
    ): Promise<Result<PlannerCompletion, PlannerFailure>> {
        const baseUrl = this.options.baseUrl.trim();
        if (baseUrl.length === 0) {
            return [null, { type: 'MISSING_ENDPOINT', message: 'PLANNER_BASE_URL is required' }];
        }
        const [response, requestError] = await this.post(baseUrl, request);
        if (requestError) return [null, requestError];
        if (response === null) {
            return [null, { type: 'MALFORMED_RESPONSE', message: 'planner response missing' }];
        }
        if (response.status < 200 || response.status >= 300) {
            return [
                null,
                {
                    type: 'HTTP',
                    status: response.status,
                    message: OpenAiPlannerClient.truncate(response.bodyText),
                },
            ];
        }
        const [decoded, decodeError] = attempt(() => JSON.parse(response.bodyText) as unknown);
        if (decodeError) {
            return [null, { type: 'MALFORMED_RESPONSE', message: 'response is not JSON' }];
        }
        const parsed = completionResponseSchema.safeParse(decoded);
        if (!parsed.success) {
            return [null, { type: 'MALFORMED_RESPONSE', message: parsed.error.message }];
        }
        const content = parsed.data.choices[0]?.message.content ?? '';
        if (content.trim().length === 0) {
            return [null, { type: 'MALFORMED_RESPONSE', message: 'response content is empty' }];
        }
        return [
            {
                content,
                usage: OpenAiPlannerClient.usage(content, parsed.data.usage),
            },
            null,
        ];
    }

    private async post(
        baseUrl: string,
        request: PlannerCompletionRequest,
    ): Promise<Result<import('./types.js').PlannerHttpResponse, PlannerFailure>> {
        if (request.signal.aborted) {
            return [null, { type: 'TRANSPORT', message: 'planner request cancelled' }];
        }
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, this.options.timeoutMilliseconds);
        const abortListener = (): void => controller.abort();
        request.signal.addEventListener('abort', abortListener, { once: true });
        const [response, transportError] = await this.options.http.post({
            url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
            apiKey: this.options.apiKey,
            bodyJson: JSON.stringify({
                model: this.options.model,
                messages: request.messages,
                max_tokens: request.maxOutputTokens,
                temperature: 0,
                response_format: { type: 'json_object' },
            }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        request.signal.removeEventListener('abort', abortListener);
        if (timedOut) {
            return [
                null,
                {
                    type: 'TRANSPORT',
                    message: `planner request timed out after ${this.options.timeoutMilliseconds}ms`,
                },
            ];
        }
        if (request.signal.aborted) {
            return [null, { type: 'TRANSPORT', message: 'planner request cancelled' }];
        }
        if (transportError) return [null, { type: 'TRANSPORT', message: transportError }];
        return [response, null];
    }

    private static usage(
        content: string,
        usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
    ): PlannerUsage {
        const inputTokens = usage?.prompt_tokens ?? 0;
        const outputTokens = usage?.completion_tokens ?? Math.ceil(content.length / 4);
        return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
    }

    private static truncate(value: string): string {
        return value.length > 500 ? `${value.slice(0, 500)}...` : value;
    }
}

import {
    DECISION_REQUEST,
    type DecisionRequest,
    decisionResponseSchema,
    type Envelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { Affordance } from './affordance-enumerator.js';
import { DeterministicPolicy, type PolicyState } from './deterministic-policy.js';

export interface DecisionTransportPort {
    request(
        type: string,
        payload: unknown,
        timeoutMilliseconds?: number,
    ): Promise<Result<Envelope, TransportFailure>>;
}

export interface LayaClientOptions {
    transport: DecisionTransportPort;
    timeoutMilliseconds: number;
    minimumConfidence: number;
    policy: DeterministicPolicy;
}

export interface LayaDecision {
    choice: Affordance;
    source: 'laya' | 'fallback';
    confidence: number;
    danger: boolean;
    shouldContinue: boolean;
    latencyMilliseconds: number;
    reason?: string;
}

export class LayaClient {
    constructor(private readonly options: LayaClientOptions) {}

    async decide(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        state: PolicyState,
    ): Promise<Result<LayaDecision, string>> {
        const [response, requestError] = await this.options.transport.request(
            DECISION_REQUEST,
            request,
            this.options.timeoutMilliseconds,
        );
        if (requestError) return this.fallback(affordances, state, requestError.type);
        if (response === null) return this.fallback(affordances, state, 'empty response');
        const parsed = decisionResponseSchema.safeParse(response.payload);
        if (!parsed.success) {
            return this.fallback(affordances, state, 'invalid response payload');
        }
        const answer = parsed.data;
        if (answer.source === 'fallback' || answer.choiceId === null) {
            return this.fallback(affordances, state, answer.reason ?? 'service fallback');
        }
        if (answer.answerConfidence < this.options.minimumConfidence) {
            return this.fallback(affordances, state, 'confidence below gate');
        }
        const choice = affordances.find((affordance) => affordance.id === answer.choiceId);
        if (choice === undefined) {
            return this.fallback(affordances, state, 'unknown affordance choice');
        }
        return [
            {
                choice,
                source: 'laya',
                confidence: answer.answerConfidence,
                danger: answer.danger,
                shouldContinue: answer.shouldContinue,
                latencyMilliseconds: answer.latencyMilliseconds,
            },
            null,
        ];
    }

    private fallback(
        affordances: readonly Affordance[],
        state: PolicyState,
        reason: string,
    ): Result<LayaDecision, string> {
        const [choice, policyError] = this.options.policy.select(affordances, state);
        if (policyError) return [null, `${reason}; deterministic policy: ${policyError}`];
        if (choice === null) return [null, `${reason}; no legal affordance`];
        return [
            {
                choice,
                source: 'fallback',
                confidence: 0,
                danger: state.health <= 0,
                shouldContinue: true,
                latencyMilliseconds: 0,
                reason,
            },
            null,
        ];
    }
}

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
import { type TacticalDecisionPermit, type TacticalDecisionPolicy } from './tactical-policy.js';

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
    tactical?: TacticalDecisionPolicy;
    now?: () => number;
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

interface PendingDecision {
    decision: LayaDecision;
    revision: number | null;
    focusKey: string | null;
    decisionKind: 'task' | 'goal' | null;
    expiresAt: number;
}

export class LayaClient {
    private inFlight = false;
    private pending: PendingDecision | null = null;
    private readonly now: () => number;

    constructor(private readonly options: LayaClientOptions) {
        this.now = options.now ?? Date.now;
    }

    async decide(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        state: PolicyState,
    ): Promise<Result<LayaDecision, string>> {
        const now = this.now();
        const pending = this.takePending(request, affordances, now);
        if (pending !== null) return [pending, null];
        const permit = this.permit(affordances.length, now);
        if (!permit.allowed) {
            return this.fallback(affordances, state, permit.reason ?? 'tactical decision skipped');
        }
        if (this.options.tactical?.mode === 'background') {
            const [fallbackDecision, fallbackError] = this.fallback(
                affordances,
                state,
                'background advisory requested',
            );
            if (fallbackError === null && !this.inFlight) {
                void this.requestInBackground(request, affordances, permit);
            }
            return [fallbackDecision, fallbackError];
        }
        return this.requestDecision(request, affordances, state, permit);
    }

    private takePending(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        now: number,
    ): LayaDecision | null {
        const pending = this.pending;
        if (pending === null) return null;
        if (pending.expiresAt <= now) {
            this.pending = null;
            return null;
        }
        if (
            pending.revision !== LayaClient.revisionOf(request) ||
            pending.focusKey !== LayaClient.focusKey(request) ||
            pending.decisionKind !== LayaClient.decisionKindOf(request)
        ) {
            this.pending = null;
            return null;
        }
        const choice = affordances.find(
            (affordance) => affordance.id === pending.decision.choice.id,
        );
        this.pending = null;
        if (choice === undefined) return null;
        return { ...pending.decision, choice };
    }

    private permit(affordanceCount: number, now: number): TacticalDecisionPermit {
        if (this.options.tactical === undefined) {
            return {
                allowed: true,
                reason: null,
                deadlineMilliseconds: this.options.timeoutMilliseconds,
            };
        }
        return this.options.tactical.request(affordanceCount, now);
    }

    private requestInBackground(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        permit: TacticalDecisionPermit,
    ): Promise<void> {
        this.inFlight = true;
        return this.requestDecision(request, affordances, LayaClient.policyState(), permit)
            .then(([decision, error]) => {
                if (error !== null || decision === null) return;
                if (decision.source !== 'laya') return;
                this.pending = {
                    decision,
                    revision: LayaClient.revisionOf(request),
                    focusKey: LayaClient.focusKey(request),
                    decisionKind: LayaClient.decisionKindOf(request),
                    expiresAt: this.now() + permit.deadlineMilliseconds,
                };
            })
            .finally(() => {
                this.inFlight = false;
            });
    }

    private async requestDecision(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        state: PolicyState,
        permit: TacticalDecisionPermit,
    ): Promise<Result<LayaDecision, string>> {
        const [response, requestError] = await this.options.transport.request(
            DECISION_REQUEST,
            request,
            permit.deadlineMilliseconds,
        );
        if (requestError) {
            this.options.tactical?.recordFailure(this.now());
            return this.fallback(affordances, state, requestError.type);
        }
        if (response === null) {
            this.options.tactical?.recordFailure(this.now());
            return this.fallback(affordances, state, 'empty response');
        }
        const parsed = decisionResponseSchema.safeParse(response.payload);
        if (!parsed.success) {
            this.options.tactical?.recordFailure(this.now());
            return this.fallback(affordances, state, 'invalid response payload');
        }
        const answer = parsed.data;
        if (answer.source === 'fallback' || answer.choiceId === null) {
            this.options.tactical?.recordSuccess();
            return this.fallback(affordances, state, answer.reason ?? 'service fallback');
        }
        if (answer.answerConfidence < this.options.minimumConfidence) {
            this.options.tactical?.recordSuccess();
            return this.fallback(affordances, state, 'confidence below gate');
        }
        const choice = affordances.find((affordance) => affordance.id === answer.choiceId);
        if (choice === undefined) {
            this.options.tactical?.recordSuccess();
            return this.fallback(affordances, state, 'unknown affordance choice');
        }
        this.options.tactical?.recordSuccess();
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

    private static revisionOf(request: DecisionRequest): number | null {
        return request.digest.workingMemoryRevision ?? null;
    }

    private static decisionKindOf(request: DecisionRequest): 'task' | 'goal' | null {
        return request.digest.decisionKind ?? null;
    }

    private static focusKey(request: DecisionRequest): string | null {
        const focus = request.digest.focus;
        if (focus === undefined || focus === null) return null;
        return `${focus.kind}:${focus.id}`;
    }

    private static policyState(): PolicyState {
        return {
            health: 20,
            food: 20,
            nearestHostileDistance: null,
            inventoryUsedRatio: 0,
        };
    }
}

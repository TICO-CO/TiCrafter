import {
    type DecisionRequest,
    type Envelope,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { Affordance } from './affordance-enumerator.js';
import { DeterministicPolicy, type PolicyState } from './deterministic-policy.js';
import { type DecisionTransportPort, LayaClient } from './laya-client.js';

const affordances: readonly Affordance[] = [
    {
        id: 'mine:0',
        skillId: 'mine',
        input: {},
        reason: 'Mine stone',
        priority: 1,
    },
    {
        id: 'eat:1',
        skillId: 'eat',
        input: {},
        reason: 'Eat food',
        priority: 2,
    },
];

const state: PolicyState = {
    health: 4,
    food: 4,
    nearestHostileDistance: 3,
    inventoryUsedRatio: 0.5,
};

function request(): DecisionRequest {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-11T12:00:00.000Z',
        digest: {
            health: 4,
            food: 4,
            position: { x: 0, y: 64, z: 0 },
            inventoryCount: 2,
        },
        affordances: affordances.map((affordance) => ({
            id: affordance.id,
            skillId: affordance.skillId,
            label: affordance.reason,
            priority: affordance.priority,
        })),
    };
}

function response(choiceId: string, confidence: number, source: 'laya' | 'fallback' = 'laya') {
    return ProtocolEnvelope.create('response', 'decision.response', {
        botId: 'bot.tibot1',
        at: '2026-11-11T12:00:00.000Z',
        choiceId,
        probabilities: { [choiceId]: confidence },
        answerConfidence: confidence,
        danger: false,
        shouldContinue: true,
        latencyMilliseconds: 12,
        source,
    });
}

class FakeTransport implements DecisionTransportPort {
    constructor(private readonly result: Result<Envelope, TransportFailure>) {}

    async request(): Promise<Result<Envelope, TransportFailure>> {
        return this.result;
    }
}

describe('LayaClient', () => {
    const client = (result: Result<Envelope, TransportFailure>) =>
        new LayaClient({
            transport: new FakeTransport(result),
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
        });

    it('returns a valid Laya choice', async () => {
        const [decision, decisionError] = await client([response('mine:0', 0.9), null]).decide(
            request(),
            affordances,
            state,
        );
        expect(decisionError).toBeNull();
        expect(decision?.source).toBe('laya');
        expect(decision?.choice.id).toBe('mine:0');
    });

    it('falls back on transport timeout', async () => {
        const [decision, decisionError] = await client([
            null,
            { type: 'DISCONNECTED', message: 'timeout' },
        ]).decide(request(), affordances, state);
        expect(decisionError).toBeNull();
        expect(decision?.source).toBe('fallback');
        expect(decision?.choice).not.toBeNull();
    });

    it('falls back below the confidence gate', async () => {
        const [decision, decisionError] = await client([response('mine:0', 0.2), null]).decide(
            request(),
            affordances,
            state,
        );
        expect(decisionError).toBeNull();
        expect(decision?.source).toBe('fallback');
    });

    it('falls back for an unknown choice id', async () => {
        const [decision, decisionError] = await client([response('unknown', 0.9), null]).decide(
            request(),
            affordances,
            state,
        );
        expect(decisionError).toBeNull();
        expect(decision?.source).toBe('fallback');
    });
});

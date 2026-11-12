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
import { TacticalDecisionPolicy } from './tactical-policy.js';

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
    calls = 0;

    constructor(private readonly result: Result<Envelope, TransportFailure>) {}

    async request(): Promise<Result<Envelope, TransportFailure>> {
        this.calls += 1;
        return this.result;
    }
}

const tactical = (
    overrides: Partial<ConstructorParameters<typeof TacticalDecisionPolicy>[0]> = {},
) =>
    new TacticalDecisionPolicy({
        enabled: true,
        mode: 'blocking',
        deadlineMilliseconds: 1000,
        minimumIntervalMilliseconds: 0,
        maxDecisionsPerMinute: 10,
        skipSingleAffordance: true,
        circuitBreakerFailureCount: 3,
        ...overrides,
    });

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

    it('skips Laya when tactical decisions are disabled or only one affordance exists', async () => {
        const disabledTransport = new FakeTransport([response('mine:0', 0.9), null]);
        const [disabled] = await new LayaClient({
            transport: disabledTransport,
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
            tactical: tactical({ enabled: false }),
        }).decide(request(), affordances, state);
        expect(disabled?.source).toBe('fallback');
        expect(disabledTransport.calls).toBe(0);

        const singleTransport = new FakeTransport([response('mine:0', 0.9), null]);
        const [single] = await new LayaClient({
            transport: singleTransport,
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
            tactical: tactical(),
        }).decide(request(), [affordances[0] as Affordance], state);
        expect(single?.source).toBe('fallback');
        expect(singleTransport.calls).toBe(0);
    });

    it('returns a background advisory at the next decision', async () => {
        const transport = new FakeTransport([response('mine:0', 0.9), null]);
        const client = new LayaClient({
            transport,
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
            tactical: tactical({ mode: 'background' }),
        });
        const [first] = await client.decide(request(), affordances, state);
        expect(first?.source).toBe('fallback');
        expect(transport.calls).toBe(1);
        await Promise.resolve();
        await Promise.resolve();
        const [second] = await client.decide(request(), affordances, state);
        expect(second?.source).toBe('laya');
        expect(second?.choice.id).toBe('mine:0');
    });

    it('discards a background advisory after the working-memory revision changes', async () => {
        const transport = new FakeTransport([response('mine:0', 0.9), null]);
        const client = new LayaClient({
            transport,
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
            tactical: tactical({ mode: 'background' }),
        });
        await client.decide(request(), affordances, state);
        await Promise.resolve();
        await Promise.resolve();
        const stale = request();
        stale.digest.workingMemoryRevision = 2;
        const [decision] = await client.decide(stale, affordances, state);
        expect(decision?.source).toBe('fallback');
        expect(transport.calls).toBe(2);
    });

    it('keeps background task and goal advisories separate', async () => {
        const transport = new FakeTransport([response('mine:0', 0.9), null]);
        const client = new LayaClient({
            transport,
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
            tactical: tactical({ mode: 'background' }),
        });
        const taskRequest = request();
        taskRequest.digest.decisionKind = 'task';
        await client.decide(taskRequest, affordances, state);
        await Promise.resolve();
        await Promise.resolve();
        const goalRequest = request();
        goalRequest.digest.decisionKind = 'goal';
        const [decision] = await client.decide(goalRequest, affordances, state);
        expect(decision?.source).toBe('fallback');
        expect(transport.calls).toBe(2);
    });

    it('opens the circuit breaker after repeated failures', async () => {
        const transport = new FakeTransport([null, { type: 'DISCONNECTED', message: 'timeout' }]);
        const client = new LayaClient({
            transport,
            timeoutMilliseconds: 100,
            minimumConfidence: 0.6,
            policy: new DeterministicPolicy(),
            tactical: tactical({ circuitBreakerFailureCount: 2 }),
        });
        await client.decide(request(), affordances, state);
        await client.decide(request(), affordances, state);
        expect(transport.calls).toBe(2);
        const [blocked] = await client.decide(request(), affordances, state);
        expect(blocked?.source).toBe('fallback');
        expect(transport.calls).toBe(2);
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

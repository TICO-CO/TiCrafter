import type { AgencySnapshot, Goal } from '@ticrafter/agency';
import type { Affordance, LayaDecision, PolicyState } from '@ticrafter/brains';
import type { DecisionRequest, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import {
    type GoalDecisionPort,
    GoalTieBreakClient,
    type GoalTieBreakInput,
} from './goal-tie-break.js';

function snapshot(): AgencySnapshot {
    return {
        at: '2026-11-12T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 6000,
        inventory: [],
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: null,
        hasBed: false,
        knownResourceSites: [],
        homeBbox: null,
        homeStatus: null,
        homeStructureId: null,
        hasBedAtHome: false,
        isSheltered: false,
        digSite: null,
        weapon: null,
        armorPieces: 0,
        armorInventoryPieces: 0,
        nightIntent: null,
    };
}

function goal(id: string): Goal {
    return {
        id,
        kind: 'explore',
        label: id,
        priority: 50,
        source: 'need',
        target: null,
        steps: [{ skillId: 'explore', label: 'Explore', input: {} }],
        expectedValue: 0.5,
        estimatedCost: 0.1,
        estimatedRisk: 0.1,
        deadline: null,
    };
}

function input(): GoalTieBreakInput {
    return {
        botId: 'bot.one',
        at: '2026-11-12T12:00:00.000Z',
        snapshot: snapshot(),
        selected: goal('goal:first'),
        candidates: [
            { goal: goal('goal:first'), score: 1 },
            { goal: goal('goal:second'), score: 0.95 },
        ],
        tactical: {
            revision: 3,
            focus: null,
            commitments: [],
            recentExperiences: [],
            interruption: null,
            strategicGoal: null,
            strategicConstraints: [],
        },
    };
}

class FakeDecisions implements GoalDecisionPort {
    request: DecisionRequest | null = null;
    source: 'laya' | 'fallback' = 'laya';
    choiceId = 'goal:goal:second';

    async decide(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        _state: PolicyState,
    ): Promise<Result<LayaDecision, string>> {
        this.request = request;
        const choice = affordances.find((affordance) => affordance.id === this.choiceId);
        if (choice === undefined) return [null, 'missing choice'];
        return [
            {
                choice,
                source: this.source,
                confidence: 0.9,
                danger: false,
                shouldContinue: true,
                latencyMilliseconds: 10,
            },
            null,
        ];
    }
}

describe('goal tie-break client', () => {
    it('maps a Laya choice back to a close goal', async () => {
        const decisions = new FakeDecisions();
        const client = new GoalTieBreakClient({ decisions });
        const [outcome, outcomeError] = await client.decide(input());
        expect(outcomeError).toBeNull();
        expect(outcome?.goal.id).toBe('goal:second');
        expect(outcome?.source).toBe('laya');
        expect(decisions.request?.digest.decisionKind).toBe('goal');
        expect(decisions.request?.digest.workingMemoryRevision).toBe(3);
    });

    it('uses the deterministic winner when Laya returns fallback', async () => {
        const decisions = new FakeDecisions();
        decisions.source = 'fallback';
        const [outcome, outcomeError] = await new GoalTieBreakClient({ decisions }).decide(input());
        expect(outcomeError).toBeNull();
        expect(outcome?.goal.id).toBe('goal:first');
        expect(outcome?.source).toBe('fallback');
    });
});

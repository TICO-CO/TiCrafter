import type { StrategicIntent } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { StrategicIntentPolicy } from './strategic-intent.js';
import type { Goal } from './types.js';

const intent: StrategicIntent = {
    planId: 'plan-1',
    primaryGoal: { kind: 'gather', weight: 0.5 },
    secondaryGoals: [{ kind: 'build-shelter', weight: 0.4 }],
    constraints: ['prioritize-safety'],
    perBot: [
        {
            botId: 'bot.one',
            priorityModifiers: { gather: 0.2, explore: -0.5 },
            constraints: ['prefer-local-work'],
        },
    ],
};

function goal(kind: Goal['kind'], priority: number): Goal {
    return {
        id: `goal:${kind}`,
        kind,
        label: kind,
        priority,
        source: 'need',
        target: null,
        steps: [],
        expectedValue: 0.5,
        estimatedCost: 0.1,
        estimatedRisk: 0.1,
        deadline: null,
    };
}

describe('StrategicIntentPolicy', () => {
    it('applies primary, secondary, and per-bot priority adjustments', () => {
        expect(StrategicIntentPolicy.priorityAdjustment(intent, 'bot.one', 'gather')).toBe(14);
        expect(StrategicIntentPolicy.priorityAdjustment(intent, 'bot.one', 'build-shelter')).toBe(
            4,
        );
        expect(StrategicIntentPolicy.priorityAdjustment(intent, 'bot.one', 'explore')).toBe(-10);
        expect(StrategicIntentPolicy.priorityAdjustment(intent, 'bot.two', 'gather')).toBe(10);
    });

    it('merges constraints and bounds adjusted priority', () => {
        expect(StrategicIntentPolicy.constraintsFor(intent, 'bot.one')).toEqual([
            'prioritize-safety',
            'prefer-local-work',
        ]);
        const goals = StrategicIntentPolicy.applyToGoals(
            [goal('gather', 95), goal('explore', 2)],
            intent,
            'bot.one',
        );
        expect(goals[0]?.priority).toBe(100);
        expect(goals[1]?.priority).toBe(0);
    });

    it('keeps the fleet intent when no bot override exists', () => {
        const merged = StrategicIntentPolicy.forBot(intent, 'bot.two');
        expect(merged.perBot).toEqual(intent.perBot);
        expect(StrategicIntentPolicy.primaryForBot(intent, 'bot.two')?.kind).toBe('gather');
    });
});

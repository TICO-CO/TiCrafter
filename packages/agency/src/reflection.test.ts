import { describe, expect, it } from 'bun:test';

import { PersonalityModel } from './personality-model.js';
import { ReflectionModel } from './reflection.js';
import type { Goal, GoalKind, Intention } from './types.js';

function goal(kind: GoalKind = 'eat'): Goal {
    return {
        id: `goal:${kind}:test`,
        kind,
        label: `Test ${kind}`,
        priority: 50,
        source: 'need',
        target: null,
        steps: [{ skillId: 'eat', label: 'Eat', input: {} }],
        expectedValue: 0.5,
        estimatedCost: 0.1,
        estimatedRisk: 0.1,
        deadline: null,
    };
}

function intention(attempts = 0): Intention {
    return {
        goalId: 'goal:eat:test',
        label: 'Test eat',
        stepIndex: 0,
        createdAt: '2026-11-12T12:00:00.000Z',
        deadline: null,
        attempts,
    };
}

describe('reflection', () => {
    it('updates mood and a bounded trait after completion', () => {
        const traits = PersonalityModel.fromBotIndex(1);
        const before = traits.weight('orderliness');
        const [reflection, reflectionError] = ReflectionModel.reflect(
            {
                goal: goal(),
                intention: intention(),
                outcome: 'completed',
                reason: null,
                traits,
            },
            { maxTraitDelta: 0.01 },
        );
        expect(reflectionError).toBeNull();
        expect(reflection?.mood).toBe('content');
        expect((reflection?.traits.weight('orderliness') ?? 0) > before).toBe(true);
        expect(reflection?.traitDeltas.orderliness).toBe(0.01);
    });

    it('reflects unsafe abandonment as caution', () => {
        const traits = PersonalityModel.fromBotIndex(2);
        const before = traits.weight('caution');
        const [reflection, reflectionError] = ReflectionModel.reflect({
            goal: goal('survive'),
            intention: intention(),
            outcome: 'abandoned',
            reason: 'unsafe',
            traits,
        });
        expect(reflectionError).toBeNull();
        expect(reflection?.mood).toBe('wary');
        expect((reflection?.traits.weight('caution') ?? 0) > before).toBe(true);
    });

    it('bounds repeated infeasible reflection and clamps traits', () => {
        const [traits, traitsError] = PersonalityModel.create({ patience: 0.999 });
        expect(traitsError).toBeNull();
        if (traits === null) return;
        const [reflection, reflectionError] = ReflectionModel.reflect(
            {
                goal: goal('gather'),
                intention: intention(5),
                outcome: 'abandoned',
                reason: 'infeasible',
                traits,
            },
            { maxTraitDelta: 0.01 },
        );
        expect(reflectionError).toBeNull();
        expect(reflection?.traitDeltas.patience).toBe(-0.01);
        expect((reflection?.traits.weight('patience') ?? -1) >= 0).toBe(true);
    });

    it('rejects an out-of-range trait delta', () => {
        const traits = PersonalityModel.fromBotIndex(1);
        const [reflection, reflectionError] = ReflectionModel.reflect(
            {
                goal: goal(),
                intention: intention(),
                outcome: 'completed',
                reason: null,
                traits,
            },
            { maxTraitDelta: 0.5 },
        );
        expect(reflection).toBeNull();
        expect(reflectionError).not.toBeNull();
    });
});

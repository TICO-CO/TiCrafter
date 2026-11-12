import type { StrategicConstraint, StrategicGoalKind, StrategicIntent } from '@ticrafter/core';

import type { Goal } from './types.js';

const PRIMARY_WEIGHT_SCALE = 20;
const SECONDARY_WEIGHT_SCALE = 10;
const OVERRIDE_SCALE = 20;
const MAXIMUM_ADJUSTMENT = 25;

export class StrategicIntentPolicy {
    static priorityAdjustment(
        intent: StrategicIntent | null,
        botId: string,
        kind: StrategicGoalKind,
    ): number {
        if (intent === null) return 0;
        let adjustment = 0;
        if (intent.primaryGoal.kind === kind) {
            adjustment += intent.primaryGoal.weight * PRIMARY_WEIGHT_SCALE;
        }
        for (const goal of intent.secondaryGoals) {
            if (goal.kind === kind) adjustment += goal.weight * SECONDARY_WEIGHT_SCALE;
        }
        const override = intent.perBot.find((entry) => entry.botId === botId);
        const modifier = override?.priorityModifiers[kind];
        if (modifier !== undefined) adjustment += modifier * OVERRIDE_SCALE;
        return Math.max(-MAXIMUM_ADJUSTMENT, Math.min(MAXIMUM_ADJUSTMENT, adjustment));
    }

    static applyToGoals(
        goals: readonly Goal[],
        intent: StrategicIntent | null,
        botId: string,
    ): readonly Goal[] {
        if (intent === null) return goals;
        return goals.map((goal) => {
            const adjustment = StrategicIntentPolicy.priorityAdjustment(intent, botId, goal.kind);
            if (adjustment === 0) return goal;
            return { ...goal, priority: Math.max(0, Math.min(100, goal.priority + adjustment)) };
        });
    }

    static constraintsFor(
        intent: StrategicIntent | null,
        botId: string,
    ): readonly StrategicConstraint[] {
        if (intent === null) return [];
        const override = intent.perBot.find((entry) => entry.botId === botId);
        return [...new Set([...intent.constraints, ...(override?.constraints ?? [])])];
    }

    static primaryForBot(
        intent: StrategicIntent | null,
        botId: string,
    ): StrategicIntent['primaryGoal'] | null {
        if (intent === null) return null;
        const override = intent.perBot.find((entry) => entry.botId === botId);
        const modifier = override?.priorityModifiers[intent.primaryGoal.kind];
        if (modifier === undefined) return intent.primaryGoal;
        return {
            ...intent.primaryGoal,
            weight: Math.max(0, Math.min(1, intent.primaryGoal.weight + modifier)),
        };
    }

    static forBot(intent: StrategicIntent, botId: string): StrategicIntent {
        const override = intent.perBot.find((entry) => entry.botId === botId);
        if (override === undefined) return intent;
        return {
            ...intent,
            constraints: [...StrategicIntentPolicy.constraintsFor(intent, botId)],
            perBot: [override],
        };
    }
}

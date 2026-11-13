import type { GoalKind, GoalSource, GoalStep } from './types.js';

export interface GoalTemplate {
    kind: GoalKind;
    label: string;
    priority: number;
    source: GoalSource;
    steps: readonly GoalStep[];
    expectedValue: number;
    estimatedCost: number;
    estimatedRisk: number;
}

export class GoalCatalog {
    static templates(): readonly GoalTemplate[] {
        return [
            GoalCatalog.template(
                'survive',
                'Retreat from nearby hostiles',
                100,
                'need',
                'flee-defend',
                {},
                1,
                0.1,
                0.3,
            ),
            GoalCatalog.template(
                'eat',
                'Eat food to restore hunger',
                90,
                'need',
                'eat',
                {},
                0.9,
                0.1,
                0.05,
            ),
            GoalCatalog.template(
                'rest',
                'Sleep through the night',
                80,
                'routine',
                'sleep',
                {},
                0.8,
                0.2,
                0.05,
            ),
            GoalCatalog.template(
                'gather',
                'Gather nearby wood',
                60,
                'need',
                'mine',
                { radius: 1 },
                0.7,
                0.4,
                0.2,
            ),
            GoalCatalog.template(
                'gather',
                'Mine nearby stone',
                60,
                'need',
                'mine',
                { radius: 1 },
                0.7,
                0.5,
                0.25,
            ),
            GoalCatalog.template(
                'craft',
                'Craft basic tools',
                50,
                'need',
                'craft',
                { itemName: 'wooden_pickaxe', count: 1 },
                0.6,
                0.3,
                0.05,
            ),
            GoalCatalog.template(
                'shelter',
                'Return to shelter',
                70,
                'routine',
                'navigate',
                { radius: 2 },
                0.8,
                0.2,
                0.1,
            ),
            GoalCatalog.template(
                'deposit',
                'Store surplus items',
                40,
                'need',
                'deposit',
                {},
                0.5,
                0.2,
                0.05,
            ),
            GoalCatalog.template(
                'explore',
                'Explore nearby terrain',
                30,
                'curiosity',
                'explore',
                { radius: 32, maxSteps: 12 },
                0.5,
                0.5,
                0.2,
            ),
            GoalCatalog.template(
                'social',
                'Greet nearby players and bots',
                20,
                'social',
                'navigate',
                { radius: 2 },
                0.4,
                0.1,
                0.0,
            ),
            GoalCatalog.template(
                'leisure',
                'Look around and idle briefly',
                10,
                'routine',
                'explore',
                { radius: 4, maxSteps: 1 },
                0.1,
                0.05,
                0.0,
            ),
            GoalCatalog.template(
                'harvest-farm',
                'Harvest mature crops',
                45,
                'need',
                'harvest-farm',
                {},
                0.5,
                0.2,
                0.05,
            ),
            GoalCatalog.template(
                'plant-farm',
                'Replant harvested crops',
                44,
                'need',
                'plant-farm',
                {},
                0.45,
                0.2,
                0.05,
            ),
            GoalCatalog.template(
                'prepare-night',
                'Prepare for nightfall',
                85,
                'routine',
                'navigate',
                {},
                0.85,
                0.2,
                0.1,
            ),
        ];
    }

    private static template(
        kind: GoalKind,
        label: string,
        priority: number,
        source: GoalSource,
        skillId: string,
        input: Readonly<Record<string, unknown>>,
        expectedValue: number,
        estimatedCost: number,
        estimatedRisk: number,
    ): GoalTemplate {
        return {
            kind,
            label,
            priority,
            source,
            steps: [{ skillId, label, input }],
            expectedValue,
            estimatedCost,
            estimatedRisk,
        };
    }
}

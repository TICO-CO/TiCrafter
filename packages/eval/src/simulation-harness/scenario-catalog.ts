import type { ScenarioAssertion } from '../behavior-assertions/index.js';
import type { BehaviorScenario } from './scenario.js';

const HOUSE_ANCHOR = { x: 6, y: 68, z: 6 };

const BUILD_TASK = {
    id: 'task.simulated-build',
    title: 'Build a house on uneven terrain',
    skillId: 'schematic-build',
    requiredRole: null,
    payload: {
        schematic: {
            id: 'template:house',
            anchor: HOUSE_ANCHOR,
            revision: 0,
        },
    },
};

const BUILD_ASSERTIONS: readonly ScenarioAssertion[] = [
    {
        id: 'build-complete',
        kind: 'world.diff-empty',
        schematicId: 'template:house',
        anchor: HOUSE_ANCHOR,
        message: 'the final world must match the stored blueprint',
    },
    {
        id: 'no-duplicate-writes',
        kind: 'world.no-duplicate-writes',
        message: 'no block position may be written twice',
    },
    {
        id: 'task-completed',
        kind: 'task.status',
        taskId: 'task.simulated-build',
        status: 'completed',
        message: 'the construction task must complete',
    },
];

export class BehaviorScenarioCatalog {
    static definitions(): readonly BehaviorScenario[] {
        return [BehaviorScenarioCatalog.simulatedBuild()];
    }

    static find(id: string): BehaviorScenario | null {
        return BehaviorScenarioCatalog.definitions().find((scenario) => scenario.id === id) ?? null;
    }

    private static simulatedBuild(): BehaviorScenario {
        return {
            id: 'simulated-build',
            title: 'Single bot builds a house on uneven terrain',
            mode: 'simulate',
            seed: 1847,
            world: {
                kind: 'uneven',
                bounds: {
                    min: { x: -8, y: 60, z: -8 },
                    max: { x: 24, y: 80, z: 24 },
                },
                groundY: 64,
                maximumStep: 2,
            },
            bots: [
                {
                    name: 'TiBot1',
                    role: 'builder',
                    inventory: {
                        oak_planks: 96,
                        cobblestone: 512,
                        dark_oak_planks: 128,
                        glass: 16,
                        oak_door: 8,
                        stone_pickaxe: 1,
                    },
                },
            ],
            startTime: { timeOfDay: 1000 },
            tasks: [BUILD_TASK],
            assumptions: {
                planner: 'disabled',
                goalTieBreak: 'disabled',
                laya: 'deterministic',
                agency: 'disabled',
            },
            assertions: BUILD_ASSERTIONS,
            timeoutTicks: 2000,
            timeoutMilliseconds: 120_000,
        };
    }
}

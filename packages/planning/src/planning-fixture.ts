import type { Result } from '@ticrafter/core';

import { type PlannerPlan, plannerPlanSchema } from './plan-schema.js';
import type {
    PlannerBotView,
    PlannerContext,
    PlannerContextSource,
    PlannerLandmarkView,
    PlannerSipView,
    PlannerTaskView,
    PlannerTrigger,
} from './types.js';

export function plannerTrigger(overrides: Partial<PlannerTrigger> = {}): PlannerTrigger {
    return {
        kind: 'interval',
        id: 'trigger-1',
        reason: 'test trigger',
        requestedAt: '2026-11-11T12:00:00.000Z',
        detail: {},
        ...overrides,
    };
}

export function plannerContext(overrides: Partial<PlannerContext> = {}): PlannerContext {
    return {
        createdAt: '2026-11-11T12:00:00.000Z',
        trigger: plannerTrigger(),
        sip: {
            revision: 5,
            zones: [
                {
                    id: 'zone-base',
                    name: 'Base',
                    type: 'base',
                    polygon: [
                        { x: 0, y: 64, z: 0 },
                        { x: 10, y: 64, z: 0 },
                        { x: 10, y: 64, z: 10 },
                    ],
                    priority: 1,
                },
            ],
            structures: [],
            roads: [],
            farms: [],
            containers: [],
            protectedBboxes: [],
            noBuildZones: [],
        },
        tasks: [],
        bots: [
            {
                id: 'bot-1',
                role: 'builder',
                online: true,
                position: { x: 0, y: 64, z: 0 },
            },
        ],
        landmarks: [],
        inventory: { oak_planks: 64 },
        ...overrides,
    };
}

export function plannerPlan(overrides: Record<string, unknown> = {}): PlannerPlan {
    const parsed = plannerPlanSchema.parse({
        schemaVersion: 1,
        planId: 'plan-1',
        baseRevision: 5,
        goals: [
            {
                id: 'goal-1',
                description: 'Build a small base',
                priority: 1,
                status: 'active',
            },
        ],
        sipMutations: [],
        tasks: [
            {
                id: 'task-1',
                title: 'Walk to build site',
                parentId: null,
                priority: 1,
                dependencies: [],
                preconditions: [],
                requiredRole: 'builder',
                target: { x: 2, y: 64, z: 2 },
                skillId: 'navigate',
                payload: {},
            },
        ],
        blueprints: [],
        recovery: { mode: 'continue', notes: '' },
        notes: '',
        ...overrides,
    });
    return parsed;
}

export class FakePlannerContextSource implements PlannerContextSource {
    constructor(private readonly context: PlannerContext = plannerContext()) {}

    snapshot(): Result<PlannerSipView, string> {
        return [this.context.sip, null];
    }

    tasks(): Result<readonly PlannerTaskView[], string> {
        return [this.context.tasks, null];
    }

    bots(): Result<readonly PlannerBotView[], string> {
        return [this.context.bots, null];
    }

    landmarks(): Result<readonly PlannerLandmarkView[], string> {
        return [this.context.landmarks, null];
    }

    inventory(): Result<Readonly<Record<string, number>>, string> {
        return [this.context.inventory, null];
    }
}

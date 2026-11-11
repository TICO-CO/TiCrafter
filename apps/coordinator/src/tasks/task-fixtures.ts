import type { CreateTaskInput, TaskClaimContext, TaskClaimPort, TaskWorldPort } from './types.js';

export class TaskFixtures {
    static world(): TaskWorldPort {
        return {
            blockAt: () => [null, null],
            intersecting: () => [[], null],
        };
    }

    static claims(overlapping = false): TaskClaimPort {
        return {
            hasActiveOverlap: () => [overlapping, null],
        };
    }

    static context(
        botId = 'bot.builder',
        overrides: Partial<TaskClaimContext> = {},
    ): TaskClaimContext {
        return {
            botId,
            botRole: 'builder',
            botPosition: { x: 0, y: 64, z: 0 },
            inventory: {},
            activeTaskCount: 0,
            world: TaskFixtures.world(),
            claims: TaskFixtures.claims(),
            ...overrides,
        };
    }

    static task(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
        return {
            id: 'task-1',
            title: 'Build a wall',
            priority: 10,
            payload: {},
            dependencies: [],
            preconditions: [],
            requiredRole: 'builder',
            target: { x: 1, y: 64, z: 1 },
            ...overrides,
        };
    }
}

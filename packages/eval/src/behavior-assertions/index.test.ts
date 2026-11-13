import { describe, expect, it } from 'bun:test';

import { AssertionEngine } from './index.js';

const context = {
    world: { blockAt: () => 'air' },
    tasks: [{ id: 'task.one', status: 'completed' }],
    events: [{ type: 'task.created', botId: null, at: '2026-01-01T00:00:00.000Z', payload: {} }],
    blockWrites: [
        {
            botId: 'bot.one',
            position: { x: 1, y: 2, z: 3 },
            authorized: true,
            at: '2026-01-01T00:00:00.000Z',
        },
    ],
    vetoes: [],
    inventory: [],
    behavior: [],
    metrics: {},
};

describe('AssertionEngine', () => {
    it('reports task status and duplicate writes', () => {
        const results = AssertionEngine.evaluate(
            [
                {
                    id: 'task',
                    kind: 'task.status',
                    taskId: 'task.one',
                    status: 'completed',
                    message: 'task must complete',
                },
                {
                    id: 'duplicates',
                    kind: 'world.no-duplicate-writes',
                    message: 'no duplicates',
                },
                {
                    id: 'event',
                    kind: 'event.exists',
                    eventType: 'task.created',
                    message: 'task event must exist',
                },
            ],
            context,
        );
        expect(results.map((result) => result.passed)).toEqual([true, true, true]);
    });

    it('fails evidence for a missing task', () => {
        const [result] = AssertionEngine.evaluate(
            [
                {
                    id: 'task',
                    kind: 'task.status',
                    taskId: 'task.missing',
                    status: 'completed',
                    message: 'task must complete',
                },
            ],
            context,
        );
        expect(result?.passed).toBe(false);
        expect(result?.actual).toBeNull();
        expect(result?.message).toBe('task must complete');
    });
});

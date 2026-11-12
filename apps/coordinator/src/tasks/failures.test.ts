import { describe, expect, it } from 'bun:test';

import { TaskFailures } from './failures.js';

describe('TaskFailures', () => {
    it('constructs each task failure variant', () => {
        expect(TaskFailures.duplicateTask('task-1')).toEqual({
            type: 'DUPLICATE_TASK',
            taskId: 'task-1',
        });
        expect(TaskFailures.taskNotFound('task-1')).toEqual({
            type: 'TASK_NOT_FOUND',
            taskId: 'task-1',
        });
        expect(TaskFailures.invalidTask('bad')).toEqual({ type: 'INVALID_TASK', message: 'bad' });
        expect(TaskFailures.malformedTask('bad')).toEqual({
            type: 'MALFORMED_TASK',
            message: 'bad',
        });
        expect(TaskFailures.dependencyCycle(['a', 'b'])).toEqual({
            type: 'DEPENDENCY_CYCLE',
            taskIds: ['a', 'b'],
        });
        expect(TaskFailures.invalidTransition('task-1', 'pending', 'running')).toEqual({
            type: 'INVALID_TRANSITION',
            taskId: 'task-1',
            from: 'pending',
            to: 'running',
        });
        expect(TaskFailures.claimConflict('task-1')).toEqual({
            type: 'CLAIM_CONFLICT',
            taskId: 'task-1',
        });
    });
});

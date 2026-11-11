import { EventLogWriter, TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { TaskBoard } from './task-board.js';
import { TaskFixtures } from './task-fixtures.js';

const now = '2026-11-11T10:00:00.000Z';
const later = '2026-11-11T10:01:00.000Z';

describe('TaskBoard', () => {
    const fresh = (): TaskBoard => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        expect(database).not.toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        return new TaskBoard({
            database: coordinatorDatabase,
            events: new EventLogWriter(coordinatorDatabase),
            transactions: new TransactionManager(coordinatorDatabase),
            world: TaskFixtures.world(),
            claims: TaskFixtures.claims(),
        });
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('creates and reads tasks', () => {
        const board = fresh();
        const [created, createError] = board.create(TaskFixtures.task(), now);
        expect(createError).toBeNull();
        expect(created?.status).toBe('pending');
        const [tasks, listError] = board.list();
        expect(listError).toBeNull();
        expect(tasks).toHaveLength(1);
        expect(tasks?.[0]?.title).toBe('Build a wall');
    });

    it('rejects duplicate task ids', () => {
        const board = fresh();
        board.create(TaskFixtures.task(), now);
        const [, duplicateError] = board.create(TaskFixtures.task(), now);
        expect(duplicateError?.type).toBe('DUPLICATE_TASK');
    });

    it('rejects dependency cycles', () => {
        const board = fresh();
        board.create(TaskFixtures.task({ id: 'task-a', dependencies: ['task-b'] }), now);
        const [, cycleError] = board.create(
            TaskFixtures.task({ id: 'task-b', dependencies: ['task-a'] }),
            now,
        );
        expect(cycleError?.type).toBe('DEPENDENCY_CYCLE');
    });

    it('claims only dependency-free tasks first', () => {
        const board = fresh();
        board.create(TaskFixtures.task({ id: 'task-a', priority: 1 }), now);
        board.create(
            TaskFixtures.task({ id: 'task-b', priority: 10, dependencies: ['task-a'] }),
            now,
        );
        const [firstLease, firstError] = board.claimNext(TaskFixtures.context('bot.one'), now);
        expect(firstError).toBeNull();
        expect(firstLease?.task.id).toBe('task-a');
        const [blockedLease, blockedError] = board.claimNext(TaskFixtures.context('bot.two'), now);
        expect(blockedError).toBeNull();
        expect(blockedLease).toBeNull();
        board.complete('task-a', 'bot.one', now);
        const [secondLease, secondError] = board.claimNext(TaskFixtures.context('bot.two'), now);
        expect(secondError).toBeNull();
        expect(secondLease?.task.id).toBe('task-b');
    });

    it('does not hand the same task to two bots', () => {
        const board = fresh();
        board.create(TaskFixtures.task(), now);
        const [firstLease] = board.claimNext(TaskFixtures.context('bot.one'), now);
        const [secondLease] = board.claimNext(TaskFixtures.context('bot.two'), now);
        expect(firstLease?.task.id).toBe('task-1');
        expect(secondLease).toBeNull();
    });

    it('honours inventory preconditions', () => {
        const board = fresh();
        board.create(
            TaskFixtures.task({
                preconditions: [{ kind: 'inventory.at-least', item: 'oak_planks', quantity: 4 }],
            }),
            now,
        );
        const [blocked] = board.claimNext(TaskFixtures.context('bot.one'), now);
        expect(blocked).toBeNull();
        const [lease] = board.claimNext(
            TaskFixtures.context('bot.one', { inventory: { oak_planks: 8 } }),
            now,
        );
        expect(lease?.task.id).toBe('task-1');
    });

    it('retries transient failures and dead-letters exhausted tasks', () => {
        const board = fresh();
        board.create(TaskFixtures.task(), now);
        const [firstLease] = board.claimNext(TaskFixtures.context('bot.one'), now);
        expect(firstLease?.task.id).toBe('task-1');
        let current = now;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            const [failed, failError] = board.fail(
                'task-1',
                'transient',
                'network blip',
                'bot.one',
                current,
            );
            expect(failError).toBeNull();
            expect(failed?.status).toBe('ready');
            expect(failed?.retryCount).toBe(attempt);
            current = new Date(Date.parse(current) + 60_000).toISOString();
            const [lease] = board.claimNext(TaskFixtures.context('bot.one'), current);
            expect(lease?.task.id).toBe('task-1');
        }
        const [dead, deadError] = board.fail(
            'task-1',
            'transient',
            'still broken',
            'bot.one',
            current,
        );
        expect(deadError).toBeNull();
        expect(dead?.status).toBe('dead_letter');
        expect(dead?.deadLetterReason).toBe('retry budget exhausted after 3 attempts');
    });

    it('rejects illegal transitions', () => {
        const board = fresh();
        board.create(TaskFixtures.task(), now);
        const [, transitionError] = board.transition(
            'task-1',
            'completed',
            'bot.one',
            'skip ahead',
            later,
        );
        expect(transitionError?.type).toBe('INVALID_TRANSITION');
    });
});

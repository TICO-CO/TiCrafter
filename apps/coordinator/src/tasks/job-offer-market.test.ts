import { EventLogWriter, TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { CoordinatorJobOfferMarket } from './coordinator-job-offer-market.js';
import { JobOfferService } from './job-offer-service.js';
import { TaskBoard } from './task-board.js';
import { TaskFixtures } from './task-fixtures.js';

const now = '2026-11-12T10:00:00.000Z';

const context = (botId = 'bot.one') => ({
    botId,
    role: 'builder' as const,
    position: { x: 0, y: 64, z: 0 },
    inventory: {},
});

describe('CoordinatorJobOfferMarket', () => {
    const fresh = () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        expect(database).not.toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const board = new TaskBoard({
            database: coordinatorDatabase,
            events: new EventLogWriter(coordinatorDatabase),
            transactions: new TransactionManager(coordinatorDatabase),
            world: TaskFixtures.world(),
            claims: TaskFixtures.claims(),
        });
        const market = new CoordinatorJobOfferMarket(
            board,
            new EventLogWriter(coordinatorDatabase),
            () => now,
        );
        return { board, market, service: new JobOfferService(market) };
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('offers ready jobs and accepts one atomically', () => {
        const { board, service } = fresh();
        board.create(TaskFixtures.task(), now);
        const [offers, offerError] = service.offer(context());
        expect(offerError).toBeNull();
        expect(offers).toHaveLength(1);
        expect(offers?.[0]?.taskId).toBe('task-1');
        const [assignment, acceptError] = service.resolve(
            context(),
            'task-1',
            'accept',
            'good fit',
        );
        expect(acceptError).toBeNull();
        expect(assignment?.task.payload).toEqual({});
        expect((assignment?.fencingToken ?? 0) > 0).toBe(true);
        expect(board.get('task-1')[0]?.status).toBe('claimed');
    });

    it('keeps deferred and declined jobs open with a reason', () => {
        const { board, service } = fresh();
        board.create(TaskFixtures.task(), now);
        const [, deferError] = service.resolve(context(), 'task-1', 'defer', 'working at home');
        expect(deferError).toBeNull();
        expect(board.get('task-1')[0]?.status).toBe('pending');
        const [, declineError] = service.resolve(context(), 'task-1', 'decline', 'role mismatch');
        expect(declineError).toBeNull();
        expect(board.get('task-1')[0]?.status).toBe('pending');
    });

    it('hides private project tasks from other bots', () => {
        const { board, service } = fresh();
        board.create(
            TaskFixtures.task({
                id: 'task-private',
                payload: { ownerBotId: 'bot.one', projectId: 'project-1', skillId: 'navigate' },
            }),
            now,
        );
        const [otherOffers] = service.offer(context('bot.two'));
        expect(otherOffers).toEqual([]);
        const [ownerOffers] = service.offer(context('bot.one'));
        expect(ownerOffers?.map((offer) => offer.taskId)).toEqual(['task-private']);
    });

    it('refuses to accept a job that another bot already claimed', () => {
        const { board, service } = fresh();
        board.create(TaskFixtures.task(), now);
        service.resolve(context('bot.one'), 'task-1', 'accept', 'first');
        const [, conflictError] = service.resolve(context('bot.two'), 'task-1', 'accept', 'second');
        expect(conflictError?.includes('no longer available')).toBe(true);
    });
});

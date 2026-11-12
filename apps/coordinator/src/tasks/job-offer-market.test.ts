import { EventLogWriter, TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import type { EditGrantRecord, EditRequestInput } from '../grants/index.js';
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
        expect(ownerOffers?.[0]?.projectId).toBe('project-1');
    });

    it('auto-issues a helper grant and persists it on the task payload', () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        if (database === null) return;
        const coordinatorDatabase = database as CoordinatorDatabase;
        const board = new TaskBoard({
            database: coordinatorDatabase,
            events: new EventLogWriter(coordinatorDatabase),
            transactions: new TransactionManager(coordinatorDatabase),
            world: TaskFixtures.world(),
            claims: TaskFixtures.claims(),
        });
        const requests: EditRequestInput[] = [];
        const market = new CoordinatorJobOfferMarket(
            board,
            new EventLogWriter(coordinatorDatabase),
            () => now,
            {
                request: (input: EditRequestInput) => {
                    requests.push(input);
                    const grant: EditGrantRecord = {
                        id: input.id,
                        structureId: input.structureId,
                        ownerBotId: 'bot.one',
                        granteeBotId: input.requesterBotId,
                        designRevision: input.observedDesignRevision,
                        bbox: input.bbox,
                        allowedOps: [...input.proposedOps],
                        materialConstraints: [],
                        intent: input.intent,
                        status: 'active',
                        expiresAt: '2026-11-13T10:00:00.000Z',
                        fencingToken: 4,
                        epoch: 1,
                        grantedBy: 'coordinator',
                        taskId: input.taskId ?? null,
                        createdAt: now,
                        updatedAt: now,
                    };
                    return [grant, null];
                },
            },
        );
        board.create(
            TaskFixtures.task({
                id: 'task-helper',
                payload: {
                    skillId: 'construction',
                    ownerBotId: 'bot.one',
                    visibleTo: 'helpers',
                    projectId: 'project-1',
                    structureId: 'structure-1',
                    workPackageId: 'package-1',
                    claimId: 'claim-1',
                    blueprintId: 'blueprint-1',
                    blueprintRevision: 1,
                    planId: 'plan-1',
                    planRevision: 1,
                    bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 66, z: 2 } },
                },
            }),
            now,
        );
        const service = new JobOfferService(market);
        const [assignment, acceptError] = service.resolve(
            context('bot.two'),
            'task-helper',
            'accept',
            'helping',
        );
        expect(acceptError).toBeNull();
        expect(requests).toHaveLength(1);
        expect(requests[0]?.allowClaimIds).toEqual(['claim-1']);
        expect(assignment?.task.payload.grantId).toBe('grant.task-helper.1');
        expect(board.get('task-helper')[0]?.payload.grantId).toBe('grant.task-helper.1');
    });

    it('refuses to accept a job that another bot already claimed', () => {
        const { board, service } = fresh();
        board.create(TaskFixtures.task(), now);
        service.resolve(context('bot.one'), 'task-1', 'accept', 'first');
        const [, conflictError] = service.resolve(context('bot.two'), 'task-1', 'accept', 'second');
        expect(conflictError?.includes('no longer available')).toBe(true);
    });
});

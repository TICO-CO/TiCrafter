import { TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { ClaimFixtures } from './claim-fixtures.js';
import { ClaimService, type ClaimServiceOptions } from './claim-service.js';

const now = '2026-11-11T10:00:00.000Z';

describe('ClaimService', () => {
    const fresh = (
        overrides: Partial<ClaimServiceOptions> = {},
    ): { service: ClaimService; requeued: string[] } => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        expect(database).not.toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const requeued: string[] = [];
        const service = new ClaimService({
            database: coordinatorDatabase,
            transactions: new TransactionManager(coordinatorDatabase),
            sessions: ClaimFixtures.sessions(),
            tasks: ClaimFixtures.tasks(requeued),
            epoch: 7,
            ...overrides,
        });
        return { service, requeued };
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('acquires and lists active claims', () => {
        const { service } = fresh();
        const [claim, claimError] = service.acquire(ClaimFixtures.input(), now);
        expect(claimError).toBeNull();
        expect(claim?.fencingToken).toBe(1);
        expect(claim?.epoch).toBe(7);
        const [active, listError] = service.listActive();
        expect(listError).toBeNull();
        expect(active).toHaveLength(1);
    });

    it('rejects overlapping claims with the configured margin', () => {
        const { service } = fresh();
        service.acquire(ClaimFixtures.input(), now);
        const [, overlapError] = service.acquire(
            ClaimFixtures.input({ id: 'claim-2', botId: 'bot.two' }),
            now,
        );
        expect(overlapError?.type).toBe('OVERLAP');
        const [overlapping] = service.hasActiveOverlap(ClaimFixtures.bbox());
        expect(overlapping).toBe(true);
    });

    it('allows non-overlapping claims and keeps fencing tokens monotonic', () => {
        const { service } = fresh();
        const [first] = service.acquire(ClaimFixtures.input(), now);
        const [second, secondError] = service.acquire(
            ClaimFixtures.input({
                id: 'claim-2',
                resourceId: 'package-2',
                bbox: ClaimFixtures.bbox(20, 20),
                botId: 'bot.two',
            }),
            now,
        );
        expect(secondError).toBeNull();
        expect(second?.fencingToken).toBe((first?.fencingToken ?? 0) + 1);
        const [overlapping] = service.hasActiveOverlap(ClaimFixtures.bbox(20, 20));
        expect(overlapping).toBe(true);
    });

    it('renews only with a valid token and live session', () => {
        const { service } = fresh();
        const [claim] = service.acquire(ClaimFixtures.input(), now);
        const token = claim?.fencingToken ?? 0;
        const [, staleError] = service.renew('claim-1', 'bot.one', token + 1, now);
        expect(staleError?.type).toBe('STALE_TOKEN');
        const [renewed, renewError] = service.renew(
            'claim-1',
            'bot.one',
            token,
            '2026-11-11T10:00:10.000Z',
        );
        expect(renewError).toBeNull();
        expect(renewed?.leaseUntil).toBe('2026-11-11T10:00:40.000Z');
    });

    it('rejects heartbeat renewals when the bot session is offline', () => {
        const { service } = fresh({ sessions: ClaimFixtures.sessions(false) });
        const [claim] = service.acquire(ClaimFixtures.input(), now);
        const [, renewError] = service.renew('claim-1', 'bot.one', claim?.fencingToken ?? 0, now);
        expect(renewError?.type).toBe('SESSION_INVALID');
    });

    it('expires overdue leases, bumps the token, and requeues the task', () => {
        const { service, requeued } = fresh();
        service.acquire(ClaimFixtures.input({ leaseTtlMilliseconds: 1_000 }), now);
        const [expired, reapError] = service.reapExpired('2026-11-11T10:00:02.000Z');
        expect(reapError).toBeNull();
        expect(expired).toHaveLength(1);
        expect(expired?.[0]?.status).toBe('expired');
        expect(expired?.[0]?.fencingToken).toBe(2);
        expect(requeued).toEqual(['task-1']);
        const [active] = service.listActive();
        expect(active).toHaveLength(0);
    });

    it('releases claims and requeues incomplete tasks', () => {
        const { service, requeued } = fresh();
        const [claim] = service.acquire(ClaimFixtures.input(), now);
        const [released, releaseError] = service.release(
            'claim-1',
            'bot.one',
            claim?.fencingToken ?? 0,
            now,
        );
        expect(releaseError).toBeNull();
        expect(released?.status).toBe('released');
        expect(requeued).toEqual(['task-1']);
    });

    it('completes claims without requeueing', () => {
        const { service, requeued } = fresh();
        const [claim] = service.acquire(ClaimFixtures.input(), now);
        const [completed, completeError] = service.complete(
            'claim-1',
            'bot.one',
            claim?.fencingToken ?? 0,
            now,
        );
        expect(completeError).toBeNull();
        expect(completed?.status).toBe('completed');
        expect(requeued).toEqual([]);
    });

    it('tracks contention metrics', () => {
        const { service } = fresh();
        service.acquire(ClaimFixtures.input(), now);
        service.acquire(ClaimFixtures.input({ id: 'claim-2' }), now);
        expect(service.contention.duplicateAttempts).toBe(1);
    });
});

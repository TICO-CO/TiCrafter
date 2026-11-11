import type { StorageFailure } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import type { BotProfile } from '../bots/index.js';
import type { ClaimRecord } from '../claims/index.js';
import type { EditGrantRecord } from '../grants/index.js';
import type { SipSnapshot } from '../sip/index.js';
import type { TaskRecord } from '../tasks/index.js';
import { OpsMetricsRegistry } from './metrics-registry.js';
import { OpsStatusAggregator } from './status-aggregator.js';
import type { OpsDecisionStatus } from './types.js';

const at = '2026-11-11T10:00:00.000Z';

const bot = (overrides: Partial<BotProfile> = {}): BotProfile =>
    ({
        botId: 'bot.one',
        username: 'TiBot1',
        role: 'builder',
        temporaryRole: null,
        status: 'online',
        currentTaskId: 'task-1',
        currentSkill: 'mine',
        lastSeen: at,
        ...overrides,
    }) as BotProfile;

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord =>
    ({ id: 'task-1', status: 'running', ...overrides }) as TaskRecord;

const claim = (overrides: Partial<ClaimRecord> = {}): ClaimRecord =>
    ({
        id: 'claim-1',
        botId: 'bot.one',
        resourceType: 'structure',
        resourceId: 'structure.house',
        leaseUntil: at,
        ...overrides,
    }) as ClaimRecord;

const grant = (overrides: Partial<EditGrantRecord> = {}): EditGrantRecord =>
    ({
        id: 'grant-1',
        structureId: 'structure.house',
        granteeBotId: 'bot.two',
        expiresAt: at,
        ...overrides,
    }) as EditGrantRecord;

const sip: SipSnapshot = {
    revision: 4,
    zones: [],
    structures: [],
    roads: [],
    farms: [],
    containers: [],
    pathGraph: { nodes: [], edges: [] },
    rules: { protectedBboxes: [], allowedEdits: [], noBreakUnderActiveBot: true },
};

const decisionStatus: OpsDecisionStatus = {
    enabled: true,
    provider: 'cpu',
    modelLoaded: true,
    failure: null,
    latency: { samples: 1, p50: 5, p95: 8, fallbackRate: 0 },
};

describe('OpsStatusAggregator', () => {
    it('aggregates fleet state and records gauges', () => {
        const metrics = new OpsMetricsRegistry();
        const aggregator = new OpsStatusAggregator({
            bots: {
                list: () => [[bot(), bot({ botId: 'bot.two', status: 'suspended' })], null],
            },
            tasks: { list: () => [[task()], null] },
            claims: { listActive: () => [[claim()], null] },
            grants: { listActive: () => [[grant()], null] },
            sip: { loadSnapshot: () => [sip, null] },
            decisions: { status: () => decisionStatus },
            metrics,
            now: () => at,
        });

        const [snapshot, snapshotError] = aggregator.snapshot();

        expect(snapshotError).toBeNull();
        expect(snapshot?.bots.online).toBe(1);
        expect(snapshot?.bots.suspended).toBe(1);
        expect(snapshot?.tasks.byStatus.running).toBe(1);
        expect(snapshot?.claims.active).toBe(1);
        expect(snapshot?.grants.active).toBe(1);
        expect(snapshot?.sip.revision).toBe(4);
        expect(metrics.snapshot().gauges.ops_bots_online).toBe(1);
    });

    it('derives current task and skill from the active task board', () => {
        const aggregator = new OpsStatusAggregator({
            bots: {
                list: () => [
                    [
                        bot({ currentTaskId: null, currentSkill: null }),
                        bot({
                            botId: 'bot.two',
                            username: 'TiBot2',
                            currentTaskId: 'stale-task',
                            currentSkill: 'mine',
                        }),
                    ],
                    null,
                ],
            },
            tasks: {
                list: () => [
                    [
                        task({
                            id: 'task-live',
                            status: 'claimed',
                            claimedBy: 'bot.one',
                            payload: { skillId: 'explore' },
                        }),
                    ],
                    null,
                ],
            },
            claims: { listActive: () => [[], null] },
            grants: { listActive: () => [[], null] },
            sip: { loadSnapshot: () => [sip, null] },
            decisions: { status: () => decisionStatus },
            now: () => at,
        });

        const [snapshot, snapshotError] = aggregator.snapshot();

        expect(snapshotError).toBeNull();
        expect(snapshot?.bots.items[0]?.currentTaskId).toBe('task-live');
        expect(snapshot?.bots.items[0]?.currentSkill).toBe('explore');
        expect(snapshot?.bots.items[1]?.currentTaskId).toBeNull();
        expect(snapshot?.bots.items[1]?.currentSkill).toBeNull();
    });

    it('maps storage failures to ops failures', () => {
        const failure: StorageFailure = { type: 'READ_FAILED', message: 'broken' };
        const aggregator = new OpsStatusAggregator({
            bots: { list: () => [[], null] },
            tasks: { list: () => [null, failure] },
            claims: { listActive: () => [[], null] },
            grants: { listActive: () => [[], null] },
            sip: { loadSnapshot: () => [sip, null] },
            decisions: { status: () => decisionStatus },
        });

        const [snapshot, snapshotError] = aggregator.snapshot();

        expect(snapshot).toBeNull();
        expect(snapshotError?.type).toBe('STORAGE');
    });
});

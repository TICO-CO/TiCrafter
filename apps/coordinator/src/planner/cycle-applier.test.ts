import type { Result } from '@ticrafter/core';
import type {
    PlannerCycleResult,
    PlannerSipProposalInput,
    PlannerTaskProposal,
} from '@ticrafter/planning';
import { describe, expect, it } from 'bun:test';

import type { SipCommit, SipFailure } from '../sip/index.js';
import type { CreateTaskInput, TaskFailure, TaskRecord } from '../tasks/index.js';
import {
    PlannerCycleApplier,
    type PlannerSipCommitPort,
    type PlannerTaskPort,
} from './cycle-applier.js';

class FakeSipCommit implements PlannerSipCommitPort {
    calls = 0;
    lastInput: PlannerSipProposalInput | null = null;

    constructor(private readonly result: Result<SipCommit, SipFailure>) {}

    commit(input: PlannerSipProposalInput): Result<SipCommit, SipFailure> {
        this.calls += 1;
        this.lastInput = input;
        return this.result;
    }
}

class FakeTaskPort implements PlannerTaskPort {
    readonly creates: CreateTaskInput[] = [];

    constructor(private readonly existing: readonly TaskRecord[] = []) {}

    get(taskId: string): Result<TaskRecord | null, TaskFailure> {
        return [this.existing.find((task) => task.id === taskId) ?? null, null];
    }

    create(input: CreateTaskInput): Result<TaskRecord, TaskFailure> {
        this.creates.push(input);
        return [taskRecord(input), null];
    }
}

function sipCommit(revision = 6): Result<SipCommit, SipFailure> {
    return [
        {
            revision,
            snapshot: {
                revision,
                zones: [],
                structures: [],
                roads: [],
                farms: [],
                containers: [],
                pathGraph: { nodes: [], edges: [] },
                rules: { protectedBboxes: [], allowedEdits: [], noBreakUnderActiveBot: false },
            },
            metadata: {
                actor: 'planner',
                expectedRevision: 5,
                idempotencyKey: 'planner:plan-1:sip',
                fencingToken: 0,
                planId: 'plan-1',
                grantId: null,
            },
            committedAt: '2026-11-11T12:00:00.000Z',
        },
        null,
    ];
}

function taskProposal(overrides: Partial<PlannerTaskProposal> = {}): PlannerTaskProposal {
    return {
        id: 'task-1',
        title: 'Walk to build site',
        parentId: null,
        priority: 1,
        payload: { skillId: 'navigate' },
        dependencies: [],
        preconditions: [],
        requiredRole: 'builder',
        target: { x: 2, y: 64, z: 2 },
        ...overrides,
    };
}

function cycle(overrides: Partial<PlannerCycleResult> = {}): PlannerCycleResult {
    return {
        source: 'planner',
        plan: null,
        applicable: true,
        sipProposal: {
            metadata: {
                actor: 'planner',
                expectedRevision: 5,
                idempotencyKey: 'planner:plan-1:sip',
                fencingToken: 0,
                planId: 'plan-1',
                grantId: null,
            },
            mutations: [],
        },
        taskProposals: [taskProposal()],
        attempts: 1,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        failure: null,
        ...overrides,
    };
}

function taskRecord(input: CreateTaskInput): TaskRecord {
    const now = '2026-11-11T12:00:00.000Z';
    return {
        id: input.id,
        parentId: input.parentId ?? null,
        title: input.title,
        status: 'pending',
        priority: input.priority ?? 0,
        retryCount: 0,
        payload: input.payload ?? {},
        dependencies: input.dependencies ?? [],
        preconditions: input.preconditions ?? [],
        requiredRole: input.requiredRole ?? null,
        target: input.target ?? null,
        claimedBy: null,
        leaseUntil: null,
        leaseToken: null,
        availableAt: now,
        failureClass: null,
        deadLetterReason: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    };
}

describe('PlannerCycleApplier', () => {
    it('commits SIP then creates tasks', () => {
        const sip = new FakeSipCommit(sipCommit());
        const tasks = new FakeTaskPort();
        const [report, applyError] = new PlannerCycleApplier({ sip, tasks }).apply(cycle());
        expect(applyError).toBeNull();
        expect(report?.sipRevision).toBe(6);
        expect(report?.tasksCreated).toBe(1);
        expect(sip.lastInput?.metadata.planId).toBe('plan-1');
        expect(tasks.creates[0]?.payload).toEqual({ skillId: 'navigate' });
    });

    it('does not create tasks when SIP commit fails', () => {
        const sip = new FakeSipCommit([null, { type: 'STALE_REVISION', expected: 1, actual: 2 }]);
        const tasks = new FakeTaskPort();
        const [, applyError] = new PlannerCycleApplier({ sip, tasks }).apply(cycle());
        expect(applyError).not.toBeNull();
        expect(tasks.creates).toHaveLength(0);
    });

    it('skips tasks that already exist', () => {
        const sip = new FakeSipCommit(sipCommit());
        const tasks = new FakeTaskPort([taskRecord({ id: 'task-1', title: 'Existing task' })]);
        const [report, applyError] = new PlannerCycleApplier({ sip, tasks }).apply(cycle());
        expect(applyError).toBeNull();
        expect(report?.tasksCreated).toBe(0);
        expect(report?.tasksSkipped).toBe(1);
    });

    it('rejects unsupported landmark precondition types', () => {
        const sip = new FakeSipCommit(sipCommit());
        const tasks = new FakeTaskPort();
        const invalid = cycle({
            taskProposals: [
                taskProposal({
                    preconditions: [
                        {
                            kind: 'world.landmark',
                            bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 1, y: 65, z: 1 } },
                            type: 'road',
                        },
                    ],
                }),
            ],
        });
        const [, applyError] = new PlannerCycleApplier({ sip, tasks }).apply(invalid);
        expect(applyError?.includes('unsupported')).toBe(true);
        expect(tasks.creates).toHaveLength(0);
    });
});

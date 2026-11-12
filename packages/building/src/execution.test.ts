import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';
import type { SafetyDecision, SafetySnapshot } from '@ticrafter/safety';
import { describe, expect, it } from 'bun:test';

import type { BuildingClock } from './block-executor.js';
import { BlockExecutor } from './block-executor.js';
import { type BlockChange, BlockVerifier } from './block-verifier.js';
import type { BlueprintBlock } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import {
    type BlockChangelogPort,
    type BlockChangeRecord,
    RollbackJournal,
    type StructureLookupPort,
} from './rollback-journal.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';

class MutableWorld implements WorldBlockQueryPort {
    private readonly blocks = new Map<string, WorldBlockState>();

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        return [this.blocks.get(MutableWorld.key(position)) ?? null, null];
    }

    set(position: Vec3, name: string): void {
        this.blocks.set(MutableWorld.key(position), { name });
    }

    private static key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

class FakeDispatcher {
    readonly requests: ActionRequest[] = [];
    dispatchError: string | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        if (this.dispatchError !== null) return [null, this.dispatchError];
        this.requests.push(request);
        return [`handle-${this.requests.length}`, null];
    }

    poll(): Result<ActionOutcome | null, string> {
        return [null, null];
    }

    cancel(): Result<void, string> {
        return [undefined, null];
    }
}

class FakeSafety {
    allowed = true;

    evaluate(): SafetyDecision {
        if (this.allowed) return { allowed: true, signals: [] };
        return {
            allowed: false,
            reason: 'test veto',
            signals: [],
            recovery: { kind: 'retry-local', reason: 'test veto' },
        };
    }
}

class FakeClock implements BuildingClock {
    constructor(private currentTime = 1000) {}

    now(): number {
        return this.currentTime;
    }

    advance(milliseconds: number): void {
        this.currentTime += milliseconds;
    }
}

class FakeWriter implements BlockChangelogPort {
    readonly records: BlockChangeRecord[] = [];

    append(record: BlockChangeRecord): Result<number, string> {
        this.records.push(record);
        return [this.records.length, null];
    }
}

class ActiveStructureLookup implements StructureLookupPort {
    structureAt(): Result<
        { id: string; ownerBotIds: string[]; status: string; designRevision: number } | null,
        BuildingFailure
    > {
        return [
            {
                id: 'structure.house',
                ownerBotIds: ['bot.owner'],
                status: 'building',
                designRevision: 1,
            },
            null,
        ];
    }
}

const TARGET: BlueprintBlock = {
    x: 1,
    y: 64,
    z: 0,
    state: { name: 'stone' },
    priority: 0,
};

const OTHER_TARGET: BlueprintBlock = {
    x: 2,
    y: 64,
    z: 0,
    state: { name: 'stone' },
    priority: 0,
};

const PLACE_CHANGE: BlockChange = {
    kind: 'place',
    botId: 'bot.builder',
    target: TARGET,
};

const SNAPSHOT: SafetySnapshot = {
    botId: 'bot.builder',
    at: '2026-11-11T12:00:00.000Z',
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    food: 20,
    oxygen: 20,
    onGround: true,
    stuckMilliseconds: 0,
    targetUnreachableMilliseconds: 0,
    inventory: [],
    inventoryUsedSlots: 0,
    inventoryTotalSlots: 36,
    hostiles: [],
    activeSkillId: null,
    claimTrackingEnabled: true,
    allowDestructiveMaterials: false,
    world: {
        blockAt: () => null,
        isProtected: () => false,
        activeBots: () => [],
        claimFor: () => null,
    },
};

describe('BlockVerifier', () => {
    it('verifies placement and breaking transitions', () => {
        const world = new MutableWorld();
        const verifier = new BlockVerifier(world);
        expect(verifier.verifyBefore(PLACE_CHANGE)[0]?.satisfied).toBe(false);

        world.set({ x: 1, y: 64, z: 0 }, 'stone');
        expect(verifier.verifyBefore(PLACE_CHANGE)[0]?.satisfied).toBe(true);
        expect(verifier.verifyAfter(PLACE_CHANGE)[0]?.satisfied).toBe(true);

        const breakChange: BlockChange = { ...PLACE_CHANGE, kind: 'break' };
        expect(verifier.verifyBefore(breakChange)[0]?.satisfied).toBe(false);
        const emptyWorld = new MutableWorld();
        expect(new BlockVerifier(emptyWorld).verifyBefore(breakChange)[0]?.satisfied).toBe(true);
    });
});

describe('RollbackJournal', () => {
    it('writes changelog entries and plans inverse operations', () => {
        const writer = new FakeWriter();
        const journal = new RollbackJournal(writer);
        const change: BlockChange = {
            kind: 'replace',
            botId: 'bot.builder',
            target: { ...TARGET, state: { name: 'oak_planks' } },
            structureId: 'structure.home',
            blueprintId: 'blueprint.home',
            blueprintRevision: 3,
            workPackageId: 'package.home.walls',
            planId: 'plan.home',
            fencingToken: 7,
            phase: 'walls',
        };
        const [entry, journalError] = journal.record(change, { name: 'stone' });

        expect(journalError).toBeNull();
        expect(entry?.id).toBe('1');
        expect(writer.records).toHaveLength(1);
        expect(writer.records[0]).toMatchObject({
            structureId: 'structure.home',
            blueprintId: 'blueprint.home',
            blueprintRevision: 3,
            workPackageId: 'package.home.walls',
            planId: 'plan.home',
            fencingToken: 7,
            phase: 'walls',
        });
        const operations = journal.planRollback();
        expect(operations).toHaveLength(2);
        expect(operations[0]?.kind).toBe('break');
        expect(operations[1]?.kind).toBe('place');
    });

    it('requires a grant when editing an active structure', () => {
        const journal = new RollbackJournal(new FakeWriter(), new ActiveStructureLookup());
        const blocked = journal.record(PLACE_CHANGE, { name: 'stone' });
        expect(blocked[1]?.type).toBe('JOURNAL_FAILED');

        const allowed = journal.record({ ...PLACE_CHANGE, grantId: 'grant-1' }, { name: 'stone' });
        expect(allowed[1]).toBeNull();
    });
});

describe('BlockExecutor', () => {
    const createExecutor = (
        world: MutableWorld,
        safety = new FakeSafety(),
        clock = new FakeClock(),
    ) => {
        const dispatcher = new FakeDispatcher();
        const writer = new FakeWriter();
        const journal = new RollbackJournal(writer);
        const executor = new BlockExecutor(new BlockVerifier(world), dispatcher, safety, journal, {
            clock,
            rateLimitMilliseconds: 100,
        });
        return { executor, dispatcher, writer, safety, clock };
    };

    it('dispatches a verified block change through safety and journal', () => {
        const world = new MutableWorld();
        const { executor, dispatcher, writer } = createExecutor(world);
        const [begin, beginError] = executor.begin(PLACE_CHANGE, SNAPSHOT);

        expect(beginError).toBeNull();
        expect(begin?.status).toBe('dispatched');
        expect(dispatcher.requests[0]).toMatchObject({
            kind: 'place-block',
            position: { x: 1, y: 64, z: 0 },
        });
        expect(writer.records).toHaveLength(1);
    });

    it('prepares without dispatching and preserves block state', () => {
        const world = new MutableWorld();
        const { executor, dispatcher } = createExecutor(world);
        const change: BlockChange = {
            ...PLACE_CHANGE,
            target: {
                ...TARGET,
                state: {
                    name: 'oak_stairs',
                    properties: { facing: 'north', half: 'bottom', shape: 'straight' },
                },
            },
        };

        const [prepared, prepareError] = executor.prepare(change, SNAPSHOT);
        expect(prepareError).toBeNull();
        expect(prepared?.status).toBe('ready');
        expect(prepared?.execution?.action).toMatchObject({
            kind: 'place-block',
            position: { x: 1, y: 64, z: 0 },
            expectedBlockId: 'oak_stairs',
            properties: { facing: 'north', half: 'bottom', shape: 'straight' },
        });
        expect(dispatcher.requests).toHaveLength(0);
    });

    it('skips blocks that already match', () => {
        const world = new MutableWorld();
        world.set({ x: 1, y: 64, z: 0 }, 'stone');
        const { executor, dispatcher } = createExecutor(world);
        const [begin, beginError] = executor.begin(PLACE_CHANGE, SNAPSHOT);

        expect(beginError).toBeNull();
        expect(begin?.status).toBe('skipped');
        expect(dispatcher.requests).toHaveLength(0);
    });

    it('rejects safety vetoes and rate-limited bursts', () => {
        const world = new MutableWorld();
        const safety = new FakeSafety();
        safety.allowed = false;
        const veto = createExecutor(world, safety);
        const [vetoed, vetoError] = veto.executor.begin(PLACE_CHANGE, SNAPSHOT);

        expect(vetoed).toBeNull();
        expect(vetoError?.type).toBe('SAFETY_VETO');
        expect(veto.dispatcher.requests).toHaveLength(0);

        const allowed = createExecutor(world);
        expect(allowed.executor.begin(PLACE_CHANGE, SNAPSHOT)[1]).toBeNull();
        const limited = allowed.executor.begin({ ...PLACE_CHANGE, target: OTHER_TARGET }, SNAPSHOT);
        expect(limited[1]?.type).toBe('RATE_LIMITED');
    });

    it('verifies completed actions and supports rollback', () => {
        const world = new MutableWorld();
        const { executor, dispatcher, clock } = createExecutor(world);
        const [begin] = executor.begin(PLACE_CHANGE, SNAPSHOT);
        if (begin?.execution === null || begin?.execution === undefined) return;

        world.set({ x: 1, y: 64, z: 0 }, 'stone');
        const [completed, completeError] = executor.complete(begin.execution, {
            request: begin.execution.action,
            status: 'completed',
        });
        expect(completeError).toBeNull();
        expect(completed?.status).toBe('completed');

        clock.advance(200);
        const [rollbackHandle, rollbackError] = executor.rollback(begin.execution, SNAPSHOT);
        expect(rollbackError).toBeNull();
        expect(rollbackHandle).toBe('handle-2');
        expect(dispatcher.requests[1]?.kind).toBe('break-block');
    });

    it('fails when the world does not match after execution', () => {
        const world = new MutableWorld();
        const { executor } = createExecutor(world);
        const [begin] = executor.begin(PLACE_CHANGE, SNAPSHOT);
        if (begin?.execution === null || begin?.execution === undefined) return;

        world.set({ x: 1, y: 64, z: 0 }, 'dirt');
        const [completed, completeError] = executor.complete(begin.execution, {
            request: begin.execution.action,
            status: 'completed',
        });
        expect(completed).toBeNull();
        expect(completeError?.type).toBe('VERIFICATION_FAILED');
    });
});

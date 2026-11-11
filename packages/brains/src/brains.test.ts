import type { Result } from '@ticrafter/core';
import {
    EmergencyStopController,
    IncidentJournal,
    RecoveryLadder,
    type SafetyEvaluator,
    type SafetyIncident,
    type SafetySnapshot,
    type SafetyWorldView,
} from '@ticrafter/safety';
import { SkillCatalog, type SkillContext, SkillRegistry } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { AffordanceEnumerator, type AffordanceRequest } from './affordance-enumerator.js';
import { DeterministicPolicy } from './deterministic-policy.js';
import { ReflexGuardianLoop } from './reflex-guardian-loop.js';

class FakeWorld implements SafetyWorldView {
    blockAt(): string | null {
        return 'air';
    }

    isProtected(): boolean {
        return false;
    }

    activeBots() {
        return [];
    }

    claimFor(): null {
        return null;
    }
}

function snapshot(): SafetySnapshot {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-10T12:00:00.000Z',
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
        claimTrackingEnabled: false,
        allowDestructiveMaterials: false,
        world: new FakeWorld(),
    };
}

function context(): SkillContext {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [],
        world: { blockAt: () => 'air', nearestContainer: () => null },
        hostiles: [
            {
                entityId: 7,
                name: 'zombie',
                position: { x: 2, y: 64, z: 0 },
                distance: 2,
                ranged: false,
                attackRange: 3,
                hasLineOfSight: true,
            },
        ],
        nearestHostile: {
            entityId: 7,
            name: 'zombie',
            position: { x: 2, y: 64, z: 0 },
            distance: 2,
            ranged: false,
            attackRange: 3,
            hasLineOfSight: true,
        },
        lastAction: null,
    };
}

function registry(): SkillRegistry {
    const [created] = SkillCatalog.createRegistry();
    expect(created).not.toBeNull();
    return created ?? new SkillRegistry();
}

function navigateRequests(count: number): AffordanceRequest[] {
    return Array.from({ length: count }, (_, index) => ({
        skillId: 'navigate',
        input: { target: { x: index + 1, y: 64, z: 0 } },
        reason: `move to target ${index + 1}`,
        priority: index + 1,
    }));
}

function guardianLoop(
    evaluators: readonly SafetyEvaluator[],
    source: { read(): Result<SafetySnapshot, string> },
    incidents: SafetyIncident[],
    now: () => number = () => Date.now(),
) {
    const emergencyStop = new EmergencyStopController();
    const journal = new IncidentJournal({ record: (incident) => incidents.push(incident) });
    const loop = new ReflexGuardianLoop(
        evaluators,
        emergencyStop,
        journal,
        new RecoveryLadder(),
        source,
        { intervalMilliseconds: 50, now },
    );
    return { loop, emergencyStop };
}

describe('affordance enumerator', () => {
    it('enumerates legal affordances within the 8-16 range', () => {
        const enumerator = new AffordanceEnumerator(registry());
        const [affordances, error] = enumerator.enumerate(context(), [
            ...navigateRequests(7),
            { skillId: 'flee-defend', input: {}, reason: 'survive', priority: 9 },
        ]);
        expect(error).toBeNull();
        expect(affordances?.length).toBe(8);
        expect(
            affordances?.some((affordance) => affordance.skillId === 'flee-defend') ?? false,
        ).toBe(true);
    });

    it('omits skills whose canRun is false', () => {
        const enumerator = new AffordanceEnumerator(registry());
        const [affordances, error] = enumerator.enumerate(context(), [
            ...navigateRequests(8),
            { skillId: 'eat', input: {}, reason: 'eat food', priority: 9 },
        ]);
        expect(error).toBeNull();
        expect(affordances?.length).toBe(8);
        expect(affordances?.some((affordance) => affordance.skillId === 'eat')).toBe(false);
    });

    for (const { count, expectedError } of [
        { count: 7, expectedError: true },
        { count: 8, expectedError: false },
        { count: 16, expectedError: false },
        { count: 17, expectedError: true },
    ]) {
        it(`enforces option count for ${count} requests`, () => {
            const enumerator = new AffordanceEnumerator(registry());
            const [affordances, error] = enumerator.enumerate(context(), navigateRequests(count));
            expect(error === null).toBe(!expectedError);
            expect(affordances?.length ?? null).toBe(expectedError ? null : count);
        });
    }

    it('rejects labels longer than twelve words', () => {
        const enumerator = new AffordanceEnumerator(registry());
        const requests = navigateRequests(8);
        requests[0] = {
            ...requests[0],
            skillId: 'navigate',
            input: { target: { x: 1, y: 64, z: 0 } },
            reason: 'one two three four five six seven eight nine ten eleven twelve thirteen',
            priority: 1,
        };
        const [affordances, error] = enumerator.enumerate(context(), requests);
        expect(affordances).toBeNull();
        expect(error === null).toBe(false);
    });
});

describe('deterministic policy', () => {
    it('prefers survival affordances under threat', () => {
        const policy = new DeterministicPolicy();
        const affordances = [
            { id: 'navigate:0', skillId: 'navigate', input: {}, reason: 'move', priority: 1 },
            { id: 'flee-defend:1', skillId: 'flee-defend', input: {}, reason: 'flee', priority: 2 },
        ];
        const [selected, error] = policy.select(affordances, {
            health: 20,
            food: 20,
            nearestHostileDistance: 2,
            inventoryUsedRatio: 0,
        });
        expect(error).toBeNull();
        expect(selected?.skillId).toBe('flee-defend');
    });

    it('prefers survival skills when health is critical', () => {
        const policy = new DeterministicPolicy();
        const affordances = [
            { id: 'navigate:0', skillId: 'navigate', input: {}, reason: 'move', priority: 5 },
            { id: 'eat:1', skillId: 'eat', input: {}, reason: 'eat', priority: 1 },
        ];
        const [selected, error] = policy.select(affordances, {
            health: 7,
            food: 10,
            nearestHostileDistance: null,
            inventoryUsedRatio: 0,
        });
        expect(error).toBeNull();
        expect(selected?.skillId).toBe('eat');
    });

    it('keeps priority ordering when health is normal', () => {
        const policy = new DeterministicPolicy();
        const affordances = [
            { id: 'navigate:0', skillId: 'navigate', input: {}, reason: 'move', priority: 5 },
            { id: 'eat:1', skillId: 'eat', input: {}, reason: 'eat', priority: 1 },
        ];
        const [selected, error] = policy.select(affordances, {
            health: 20,
            food: 10,
            nearestHostileDistance: null,
            inventoryUsedRatio: 0,
        });
        expect(error).toBeNull();
        expect(selected?.skillId).toBe('navigate');
    });
});

describe('reflex guardian loop', () => {
    it('triggers emergency stop for hazard signals and journals once', () => {
        const incidents: SafetyIncident[] = [];
        const evaluator: SafetyEvaluator = {
            evaluate: () => [{ code: 'hazard.void', severity: 'critical', message: 'void nearby' }],
        };
        const { loop, emergencyStop } = guardianLoop(
            [evaluator],
            {
                read: () => [snapshot(), null],
            },
            incidents,
        );
        const [firstReport, firstError] = loop.tick();
        expect(firstError).toBeNull();
        expect(firstReport?.emergencyStop).toBe(true);
        expect(emergencyStop.stopped).toBe(true);
        loop.tick();
        expect(incidents).toHaveLength(1);
    });

    it('marks safe mode in the guardian report', () => {
        const baseTime = Date.parse('2026-11-10T12:00:00.000Z');
        let currentTime = baseTime;
        const incidents: SafetyIncident[] = [];
        const evaluator: SafetyEvaluator = {
            evaluate: () => [
                { code: 'inventory.full', severity: 'warning', message: 'inventory nearly full' },
            ],
        };
        const { loop } = guardianLoop(
            [evaluator],
            {
                read: () => [snapshot(), null],
            },
            incidents,
            () => currentTime,
        );
        loop.tick();
        currentTime = baseTime + 5_000;
        loop.tick();
        currentTime = baseTime + 10_000;
        loop.tick();
        currentTime = baseTime + 15_000;
        const [report, error] = loop.tick();
        expect(error).toBeNull();
        expect(report?.recovery.kind).toBe('safe-mode');
        expect(report?.safeMode).toBe(true);
        expect(incidents).toHaveLength(0);
    });

    it('fails closed when an evaluator throws', () => {
        const incidents: SafetyIncident[] = [];
        const evaluator: SafetyEvaluator = {
            evaluate: () => JSON.parse('{'),
        };
        const { loop, emergencyStop } = guardianLoop(
            [evaluator],
            {
                read: () => [snapshot(), null],
            },
            incidents,
        );
        const [report, error] = loop.tick();
        expect(report).toBeNull();
        expect(error === null).toBe(false);
        expect(emergencyStop.stopped).toBe(true);
        loop.tick();
        expect(incidents).toHaveLength(1);
    });

    it('fails closed when the snapshot read fails or throws', () => {
        const incidents: SafetyIncident[] = [];
        const readFailure = guardianLoop([], { read: () => [null, 'read failed'] }, incidents);
        expect(readFailure.loop.tick()[1]).toBe('read failed');
        expect(readFailure.emergencyStop.stopped).toBe(true);

        const readThrow = guardianLoop(
            [],
            {
                read: () => JSON.parse('{'),
            },
            incidents,
        );
        expect(readThrow.loop.tick()[1] === null).toBe(false);
        expect(readThrow.emergencyStop.stopped).toBe(true);
    });
});

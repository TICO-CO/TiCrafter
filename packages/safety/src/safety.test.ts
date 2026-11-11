import { describe, expect, it } from 'bun:test';

import { ActionVetoGate } from './action-veto-gate.js';
import { ClaimLossEvaluator } from './claim-loss-evaluator.js';
import { EmergencyStopController } from './emergency-stop-controller.js';
import { HazardEvaluator } from './hazard-evaluator.js';
import { HungerEvaluator } from './hunger-evaluator.js';
import { IncidentJournal } from './incident-journal.js';
import { InventoryEvaluator } from './inventory-evaluator.js';
import { MobThreatEvaluator } from './mob-threat-evaluator.js';
import { RecoveryLadder } from './recovery-ladder.js';
import { SafetyPolicyEngine } from './safety-policy-engine.js';
import { StuckTimeoutEvaluator } from './stuck-evaluator.js';
import type {
    SafetyClaim,
    SafetyEvaluator,
    SafetyIncident,
    SafetySignal,
    SafetySnapshot,
    SafetyWorldView,
} from './types.js';

class FakeWorld implements SafetyWorldView {
    protectedRegion = false;
    blocks = new Map<string, string>();
    bots: { botId: string; position: { x: number; y: number; z: number } }[] = [];
    claim: SafetyClaim | null = null;

    blockAt(position: { x: number; y: number; z: number }): string | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? 'air';
    }

    isProtected(): boolean {
        return this.protectedRegion;
    }

    activeBots() {
        return this.bots;
    }

    claimFor(): SafetyClaim | null {
        return this.claim;
    }
}

function snapshot(
    world: SafetyWorldView = new FakeWorld(),
    overrides: Partial<SafetySnapshot> = {},
): SafetySnapshot {
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
        inventory: [{ name: 'bread', count: 2 }],
        inventoryUsedSlots: 1,
        inventoryTotalSlots: 36,
        nearestHostileDistance: null,
        activeSkillId: null,
        claimTrackingEnabled: false,
        allowDestructiveMaterials: false,
        world,
        ...overrides,
    };
}

function claimSnapshot(claim: SafetyClaim | null, at = '2026-11-10T12:00:00.000Z') {
    const world = new FakeWorld();
    world.claim = claim;
    return snapshot(world, { at, activeSkillId: 'mine', claimTrackingEnabled: true });
}

function evaluate(evaluator: SafetyEvaluator, state: SafetySnapshot): readonly SafetySignal[] {
    return evaluator.evaluate(state);
}

describe('safety evaluators', () => {
    it('flags lava, mobs, hunger, stuck movement, and full inventory', () => {
        const world = new FakeWorld();
        world.blocks.set('0,63,0', 'lava');
        const state = snapshot(world, {
            nearestHostileDistance: 2,
            food: 2,
            stuckMilliseconds: 16_000,
            inventoryUsedSlots: 36,
        });
        const signals = [
            ...evaluate(new HazardEvaluator(), state),
            ...evaluate(new MobThreatEvaluator(), state),
            ...evaluate(new HungerEvaluator(), state),
            ...evaluate(new StuckTimeoutEvaluator(), state),
            ...evaluate(new InventoryEvaluator(), state),
        ];
        expect(signals.map((signal) => signal.code)).toEqual([
            'hazard.lava',
            'mob.threat',
            'hunger.low',
            'movement.stuck',
            'inventory.full',
        ]);
    });

    for (const { food, expected } of [
        { food: 7, expected: null },
        { food: 6, expected: 'warning' },
        { food: 3, expected: 'warning' },
        { food: 2, expected: 'critical' },
        { food: 0, expected: 'critical' },
    ]) {
        it(`evaluates hunger boundary ${food}`, () => {
            const [signal] = evaluate(new HungerEvaluator(), snapshot(undefined, { food }));
            expect(signal?.severity ?? null).toBe(expected);
        });
    }

    for (const { usedSlots, expected } of [
        { usedSlots: 32, expected: null },
        { usedSlots: 33, expected: 'warning' },
        { usedSlots: 35, expected: 'warning' },
        { usedSlots: 36, expected: 'critical' },
    ]) {
        it(`evaluates inventory boundary ${usedSlots}`, () => {
            const state = snapshot(undefined, { inventoryUsedSlots: usedSlots });
            const [signal] = evaluate(new InventoryEvaluator(), state);
            expect(signal?.severity ?? null).toBe(expected);
        });
    }

    for (const { fallDistance, falling, expected } of [
        { fallDistance: 3, falling: false, expected: null },
        { fallDistance: 4, falling: undefined, expected: 'hazard.fall' },
        { fallDistance: 0, falling: true, expected: 'hazard.fall' },
    ]) {
        it(`evaluates fall boundary ${fallDistance}`, () => {
            const state = snapshot(undefined, { fallDistance, falling });
            const [signal] = evaluate(new HazardEvaluator(), state);
            expect(signal?.code ?? null).toBe(expected);
        });
    }
});

describe('claim loss evaluator', () => {
    it('ignores claims when claim tracking is disabled', () => {
        const state = snapshot(undefined, { activeSkillId: 'mine' });
        expect(evaluate(new ClaimLossEvaluator(), state)).toEqual([]);
    });

    for (const { claim, at, expected } of [
        { claim: null, at: '2026-11-10T12:00:00.000Z', expected: 'missing' },
        {
            claim: { id: 'claim.1', expiresAt: 'not-a-date' },
            at: '2026-11-10T12:00:00.000Z',
            expected: 'invalid expiry',
        },
        {
            claim: { id: 'claim.1' } as SafetyClaim,
            at: '2026-11-10T12:00:00.000Z',
            expected: 'missing',
        },
        {
            claim: { id: 'claim.1', expiresAt: '2026-11-10T12:00:00.000Z' },
            at: '2026-11-10T12:00:00.000Z',
            expected: 'expired',
        },
        {
            claim: { id: 'claim.1', expiresAt: '2026-11-10T12:00:00.000Z' },
            at: '2026-11-10T11:59:59.999Z',
            expected: null,
        },
    ]) {
        it(`rejects ${expected ?? 'valid'} claim state closed`, () => {
            const [signal] = evaluate(new ClaimLossEvaluator(), claimSnapshot(claim, at));
            if (expected === null) {
                expect(signal).toBe(undefined);
                return;
            }
            expect(signal?.code).toBe('claim.lost');
            expect(signal?.message.includes(expected) ?? false).toBe(true);
        });
    }

    it('rejects an invalid evaluation timestamp closed', () => {
        const claim = { id: 'claim.1', expiresAt: '2026-11-10T12:00:00.000Z' };
        const [signal] = evaluate(new ClaimLossEvaluator(), claimSnapshot(claim, 'invalid-time'));
        expect(signal?.code).toBe('claim.lost');
    });
});

describe('active bot support rule', () => {
    for (const { blockY, expected } of [
        { blockY: 66, expected: false },
        { blockY: 65, expected: false },
        { blockY: 64, expected: false },
        { blockY: 63, expected: false },
        { blockY: 62, expected: true },
        { blockY: 67, expected: true },
    ]) {
        it(`protects support range for block y=${blockY}`, () => {
            const world = new FakeWorld();
            world.bots = [{ botId: 'bot.tibot2', position: { x: 2, y: 65.9, z: 0 } }];
            const gate = new ActionVetoGate(
                new SafetyPolicyEngine(),
                new EmergencyStopController(),
            );
            const decision = gate.evaluate(snapshot(world), {
                kind: 'break-block',
                position: { x: 2, y: blockY, z: 0 },
            });
            expect(decision.allowed).toBe(expected);
        });
    }

    it('does not protect blocks outside the bot column', () => {
        const world = new FakeWorld();
        world.bots = [{ botId: 'bot.tibot2', position: { x: 2, y: 65, z: 0 } }];
        const gate = new ActionVetoGate(new SafetyPolicyEngine(), new EmergencyStopController());
        const decision = gate.evaluate(snapshot(world), {
            kind: 'break-block',
            position: { x: 3, y: 64, z: 0 },
        });
        expect(decision.allowed).toBe(true);
    });
});

describe('action veto gate', () => {
    const criticalCases = [
        {
            name: 'lava',
            evaluator: new HazardEvaluator(),
            state: () => {
                const world = new FakeWorld();
                world.blocks.set('0,63,0', 'lava');
                return snapshot(world);
            },
        },
        {
            name: 'mob',
            evaluator: new MobThreatEvaluator(),
            state: () => snapshot(undefined, { nearestHostileDistance: 2 }),
        },
        {
            name: 'stuck',
            evaluator: new StuckTimeoutEvaluator(),
            state: () => snapshot(undefined, { stuckMilliseconds: 16_000 }),
        },
        {
            name: 'inventory',
            evaluator: new InventoryEvaluator(),
            state: () => snapshot(undefined, { inventoryUsedSlots: 36 }),
        },
    ];
    for (const { name, evaluator, state } of criticalCases) {
        it(`denies critical ${name} signals for non-recovery actions`, () => {
            const gate = new ActionVetoGate(
                new SafetyPolicyEngine(),
                new EmergencyStopController(),
                [evaluator],
            );
            const denied = gate.evaluate(state(), {
                kind: 'break-block',
                position: { x: 1, y: 64, z: 0 },
            });
            const recovery = gate.evaluate(state(), {
                kind: 'move-to',
                position: { x: 1, y: 64, z: 0 },
            });
            expect(denied.allowed).toBe(false);
            expect(recovery.allowed).toBe(true);
        });
    }

    it('allows recovery actions while hunger is critical but denies other actions', () => {
        const gate = new ActionVetoGate(new SafetyPolicyEngine(), new EmergencyStopController(), [
            new HungerEvaluator(),
        ]);
        const state = snapshot(undefined, { food: 2 });
        expect(gate.evaluate(state, { kind: 'consume', itemName: 'bread' }).allowed).toBe(true);
        expect(gate.evaluate(state, { kind: 'wait', milliseconds: 1 }).allowed).toBe(true);
        expect(
            gate.evaluate(state, { kind: 'break-block', position: { x: 1, y: 64, z: 0 } }).allowed,
        ).toBe(false);
    });

    it('denies banned materials and protected regions', () => {
        const world = new FakeWorld();
        world.blocks.set('1,64,0', 'lava');
        const gate = new ActionVetoGate(new SafetyPolicyEngine(), new EmergencyStopController());
        const materialDecision = gate.evaluate(snapshot(world), {
            kind: 'break-block',
            position: { x: 1, y: 64, z: 0 },
        });
        expect(materialDecision.allowed).toBe(false);

        world.protectedRegion = true;
        const protectedDecision = gate.evaluate(snapshot(world), {
            kind: 'place-block',
            position: { x: 1, y: 64, z: 0 },
            itemName: 'stone',
        });
        expect(protectedDecision.allowed).toBe(false);
    });

    it('denies all actions after emergency stop', () => {
        const emergencyStop = new EmergencyStopController();
        emergencyStop.trigger('lava');
        const gate = new ActionVetoGate(new SafetyPolicyEngine(), emergencyStop);
        const decision = gate.evaluate(snapshot(undefined, { food: 2 }), {
            kind: 'consume',
            itemName: 'bread',
        });
        expect(decision.allowed).toBe(false);
    });

    it('denies non-recovery actions while safe mode is active and resets without signals', () => {
        const recovery = new RecoveryLadder();
        recovery.enterSafeMode('manual safe mode');
        const gate = new ActionVetoGate(
            new SafetyPolicyEngine(),
            new EmergencyStopController(),
            [new InventoryEvaluator()],
            recovery,
        );
        const warningState = snapshot(undefined, { inventoryUsedSlots: 33 });
        expect(
            gate.evaluate(warningState, { kind: 'break-block', position: { x: 1, y: 64, z: 0 } })
                .allowed,
        ).toBe(false);
        expect(
            gate.evaluate(warningState, { kind: 'craft', itemName: 'stick', count: 1 }).allowed,
        ).toBe(false);
        expect(
            gate.evaluate(warningState, { kind: 'move-to', position: { x: 1, y: 64, z: 0 } })
                .allowed,
        ).toBe(true);
        expect(gate.evaluate(warningState, { kind: 'consume' }).allowed).toBe(true);
        expect(
            gate.evaluate(snapshot(), { kind: 'break-block', position: { x: 1, y: 64, z: 0 } })
                .allowed,
        ).toBe(true);
        expect(recovery.safeModeActive).toBe(false);
    });
});

describe('recovery ladder', () => {
    it('escalates deterministically across repeated signals', () => {
        const ladder = new RecoveryLadder();
        const warning: SafetySignal[] = [
            { code: 'inventory.full', severity: 'warning', message: 'inventory nearly full' },
        ];
        expect(ladder.next(warning, 0).kind).toBe('retry-local');
        expect(ladder.next(warning, 5_000).kind).toBe('deterministic-alternative');
        expect(ladder.next(warning, 10_000).kind).toBe('planner-replan');
        expect(ladder.next(warning, 15_000).kind).toBe('safe-mode');
        expect(ladder.safeModeActive).toBe(true);
        expect(ladder.next(warning, 20_000).kind).toBe('emergency-stop');
        expect(ladder.next(warning, 25_000).kind).toBe('emergency-stop');
    });

    const floorCases = [
        {
            signal: { code: 'hazard.void', severity: 'critical', message: 'void' },
            kind: 'emergency-stop',
        },
        {
            signal: { code: 'claim.lost', severity: 'critical', message: 'claim lost' },
            kind: 'safe-mode',
        },
        {
            signal: { code: 'hazard.lava', severity: 'critical', message: 'lava' },
            kind: 'safe-mode',
        },
        {
            signal: { code: 'hunger.low', severity: 'critical', message: 'food' },
            kind: 'deterministic-alternative',
        },
        {
            signal: { code: 'mob.threat', severity: 'critical', message: 'mob' },
            kind: 'deterministic-alternative',
        },
    ] satisfies readonly { signal: SafetySignal; kind: string }[];
    for (const { signal, kind } of floorCases) {
        it(`maps ${signal.code} to ${kind}`, () => {
            const ladder = new RecoveryLadder();
            expect(ladder.next([signal]).kind).toBe(kind);
        });
    }

    it('resets on no signals and explicit reset', () => {
        const ladder = new RecoveryLadder();
        const warning: SafetySignal[] = [
            { code: 'inventory.full', severity: 'warning', message: 'inventory nearly full' },
        ];
        ladder.next(warning);
        ladder.next(warning);
        expect(ladder.next([]).kind).toBe('retry-local');
        expect(ladder.safeModeActive).toBe(false);

        ladder.enterSafeMode('safe');
        expect(ladder.safeModeActive).toBe(true);
        ladder.reset();
        expect(ladder.safeModeActive).toBe(false);
        expect(ladder.next(warning).kind).toBe('retry-local');
    });
});

describe('emergency stop and incident journal', () => {
    it('keeps the first emergency stop reason until resumed', () => {
        const emergencyStop = new EmergencyStopController();
        emergencyStop.trigger('first');
        emergencyStop.trigger('second');
        expect(emergencyStop.stopReason).toBe('first');
        emergencyStop.resume();
        expect(emergencyStop.stopped).toBe(false);
        emergencyStop.trigger('third');
        expect(emergencyStop.stopReason).toBe('third');
    });

    it('deduplicates repeated incidents and records vetoes', () => {
        const incidents: SafetyIncident[] = [];
        const journal = new IncidentJournal({ record: (incident) => incidents.push(incident) });
        const state = snapshot();
        expect(journal.recordOnce(state, 'hazard.lava', 'lava')).toBe(true);
        expect(journal.recordOnce(state, 'hazard.lava', 'lava')).toBe(false);
        expect(
            journal.recordVeto(
                state,
                { kind: 'break-block', position: { x: 0, y: 0, z: 0 } },
                'denied',
            ),
        ).toBe(true);
        expect(incidents).toHaveLength(2);
        expect(incidents[1]?.action?.kind).toBe('break-block');
        journal.resetDeduplication();
        expect(journal.recordOnce(state, 'hazard.lava', 'lava')).toBe(true);
        expect(incidents).toHaveLength(3);
    });
});

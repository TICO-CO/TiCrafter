import { describe, expect, it } from 'bun:test';

import { ActionVetoGate } from './action-veto-gate.js';
import { ClaimLossEvaluator } from './claim-loss-evaluator.js';
import { EmergencyStopController } from './emergency-stop-controller.js';
import { HazardEvaluator } from './hazard-evaluator.js';
import { HungerEvaluator } from './hunger-evaluator.js';
import { InventoryEvaluator } from './inventory-evaluator.js';
import { MobThreatEvaluator } from './mob-threat-evaluator.js';
import { RecoveryLadder } from './recovery-ladder.js';
import { SafetyPolicyEngine } from './safety-policy-engine.js';
import { StuckTimeoutEvaluator } from './stuck-evaluator.js';
import type { SafetySnapshot, SafetyWorldView } from './types.js';

class FakeWorld implements SafetyWorldView {
    protectedRegion = false;
    blocks = new Map<string, string>();
    bots: { botId: string; position: { x: number; y: number; z: number } }[] = [];

    blockAt(position: { x: number; y: number; z: number }): string | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? 'air';
    }

    isProtected(): boolean {
        return this.protectedRegion;
    }

    activeBots() {
        return this.bots;
    }

    claimFor(): null {
        return null;
    }
}

function snapshot(world: SafetyWorldView = new FakeWorld()): SafetySnapshot {
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
    };
}

describe('safety evaluators', () => {
    it('flags lava, mobs, hunger, stuck movement, and full inventory', () => {
        const world = new FakeWorld();
        world.blocks.set('0,63,0', 'lava');
        const state = {
            ...snapshot(world),
            nearestHostileDistance: 2,
            food: 2,
            stuckMilliseconds: 16_000,
            inventoryUsedSlots: 36,
        };
        const signals = [
            ...new HazardEvaluator().evaluate(state),
            ...new MobThreatEvaluator().evaluate(state),
            ...new HungerEvaluator().evaluate(state),
            ...new StuckTimeoutEvaluator().evaluate(state),
            ...new InventoryEvaluator().evaluate(state),
        ];
        expect(signals.map((signal) => signal.code)).toEqual([
            'hazard.lava',
            'mob.threat',
            'hunger.low',
            'movement.stuck',
            'inventory.full',
        ]);
    });

    it('ignores claims when claim tracking is disabled', () => {
        const state = { ...snapshot(), activeSkillId: 'mine' };
        expect(new ClaimLossEvaluator().evaluate(state)).toEqual([]);
    });

    it('flags missing claims when tracking is enabled', () => {
        const state = {
            ...snapshot(),
            activeSkillId: 'mine',
            claimTrackingEnabled: true,
        };
        expect(new ClaimLossEvaluator().evaluate(state)[0]?.code).toBe('claim.lost');
    });
});

describe('action veto gate', () => {
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

    it('denies breaking a block supporting another bot', () => {
        const world = new FakeWorld();
        world.bots = [{ botId: 'bot.tibot2', position: { x: 2, y: 65, z: 0 } }];
        const gate = new ActionVetoGate(new SafetyPolicyEngine(), new EmergencyStopController());
        const decision = gate.evaluate(snapshot(world), {
            kind: 'break-block',
            position: { x: 2, y: 64, z: 0 },
        });
        expect(decision.allowed).toBe(false);
    });

    it('denies all actions after emergency stop', () => {
        const emergencyStop = new EmergencyStopController();
        emergencyStop.trigger('lava');
        const gate = new ActionVetoGate(new SafetyPolicyEngine(), emergencyStop);
        const decision = gate.evaluate(snapshot(), { kind: 'wait', milliseconds: 1 });
        expect(decision.allowed).toBe(false);
    });
});

describe('recovery ladder', () => {
    it('escalates hazards to emergency stop but not hunger', () => {
        const ladder = new RecoveryLadder();
        expect(
            ladder.next([{ code: 'hazard.void', severity: 'critical', message: 'void' }]).kind,
        ).toBe('emergency-stop');
        expect(
            ladder.next([{ code: 'hunger.low', severity: 'critical', message: 'food' }]).kind,
        ).toBe('deterministic-alternative');
    });
});

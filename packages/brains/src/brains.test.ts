import type { Result } from '@ticrafter/core';
import {
    EmergencyStopController,
    IncidentJournal,
    RecoveryLadder,
    type SafetyEvaluator,
    type SafetySnapshot,
    type SafetyWorldView,
} from '@ticrafter/safety';
import { SkillCatalog, type SkillContext, SkillRegistry } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { AffordanceEnumerator } from './affordance-enumerator.js';
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
        nearestHostileDistance: 3,
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
        nearestHostile: {
            entityId: 7,
            name: 'zombie',
            position: { x: 2, y: 64, z: 0 },
            distance: 2,
        },
        lastAction: null,
    };
}

function registry(): SkillRegistry {
    const [created] = SkillCatalog.createRegistry();
    expect(created).not.toBeNull();
    return created ?? new SkillRegistry();
}

describe('brains', () => {
    it('enumerates legal affordances', () => {
        const enumorator = new AffordanceEnumerator(registry());
        const [affordances, error] = enumorator.enumerate(context(), [
            {
                skillId: 'navigate',
                input: { target: { x: 8, y: 64, z: 0 } },
                reason: 'move',
                priority: 1,
            },
            { skillId: 'flee-defend', input: {}, reason: 'survive', priority: 2 },
        ]);
        expect(error).toBeNull();
        expect(affordances?.map((affordance) => affordance.skillId)).toEqual([
            'navigate',
            'flee-defend',
        ]);
    });

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

    it('triggers emergency stop for hazard signals', () => {
        const emergencyStop = new EmergencyStopController();
        const journal = new IncidentJournal({ record: () => undefined });
        const evaluator: SafetyEvaluator = {
            evaluate: () => [{ code: 'hazard.void', severity: 'critical', message: 'void nearby' }],
        };
        const loop = new ReflexGuardianLoop(
            [evaluator],
            emergencyStop,
            journal,
            new RecoveryLadder(),
            { read: (): Result<SafetySnapshot, string> => [snapshot(), null] },
            { intervalMilliseconds: 50 },
        );
        const [report, error] = loop.tick();
        expect(error).toBeNull();
        expect(report?.emergencyStop).toBe(true);
        expect(emergencyStop.stopped).toBe(true);
    });
});

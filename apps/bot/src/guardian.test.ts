import type { Result } from '@ticrafter/core';
import type {
    SafetyClaim,
    SafetyIncident,
    SafetySnapshot,
    SafetyWorldView,
} from '@ticrafter/safety';
import { EmergencyStopController } from '@ticrafter/safety';
import { describe, expect, it } from 'bun:test';

import { GuardianHook } from './guardian.js';

class FakeWorld implements SafetyWorldView {
    blocks = new Map<string, string>();

    blockAt(position: { x: number; y: number; z: number }): string | null {
        return this.blocks.get(`${position.x},${position.y},${position.z}`) ?? 'air';
    }

    isProtected(): boolean {
        return false;
    }

    activeBots() {
        return [];
    }

    claimFor(): SafetyClaim | null {
        return null;
    }
}

class FakeSource {
    constructor(private snapshot: SafetySnapshot) {}

    set(snapshot: SafetySnapshot): void {
        this.snapshot = snapshot;
    }

    read(): Result<SafetySnapshot, string> {
        return [this.snapshot, null];
    }
}

function snapshot(world: SafetyWorldView): SafetySnapshot {
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
        nearestHostileDistance: null,
        activeSkillId: null,
        claimTrackingEnabled: false,
        allowDestructiveMaterials: false,
        world,
    };
}

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function hazardSnapshot(): SafetySnapshot {
    const world = new FakeWorld();
    world.blocks.set('0,63,0', 'lava');
    return snapshot(world);
}

describe('guardian hook', () => {
    it('vetoes critical hazards for non-recovery actions and allows move-to', () => {
        const source = new FakeSource(hazardSnapshot());
        const guardian = new GuardianHook({ source, logger });

        const blocked = guardian.evaluate({
            kind: 'break-block',
            position: { x: 1, y: 64, z: 0 },
        });
        const escape = guardian.evaluate({ kind: 'move-to', position: { x: 2, y: 64, z: 0 } });

        expect(blocked.allowed).toBe(false);
        expect(guardian.safeModeActive).toBe(true);
        expect(escape.allowed).toBe(true);
    });

    it('denies non-recovery actions in safe mode while allowing recovery actions', () => {
        const source = new FakeSource(hazardSnapshot());
        const guardian = new GuardianHook({ source, logger });
        guardian.evaluate({ kind: 'break-block', position: { x: 1, y: 64, z: 0 } });

        expect(guardian.safeModeActive).toBe(true);
        expect(guardian.evaluate({ kind: 'craft', itemName: 'stick', count: 1 }).allowed).toBe(
            false,
        );
        expect(
            guardian.evaluate({ kind: 'move-to', position: { x: 2, y: 64, z: 0 } }).allowed,
        ).toBe(true);
    });

    it('keeps emergency stop blocking every action until resumed', () => {
        const emergencyStop = new EmergencyStopController();
        const source = new FakeSource(snapshot(new FakeWorld()));
        const guardian = new GuardianHook({ source, logger, emergencyStop });
        emergencyStop.trigger('operator stop');

        const stopped = guardian.evaluate({ kind: 'wait', milliseconds: 1 });
        expect(stopped.allowed).toBe(false);
        expect(guardian.emergencyStopActive).toBe(true);

        guardian.resumeSafety();

        expect(guardian.emergencyStopActive).toBe(false);
        expect(guardian.evaluate({ kind: 'wait', milliseconds: 1 }).allowed).toBe(true);
    });

    it('triggers an operator emergency stop until resumed', () => {
        const source = new FakeSource(snapshot(new FakeWorld()));
        const guardian = new GuardianHook({ source, logger });

        guardian.triggerEmergencyStop('operator stop');
        expect(guardian.emergencyStopActive).toBe(true);
        expect(guardian.evaluate({ kind: 'wait', milliseconds: 1 }).allowed).toBe(false);

        guardian.resumeSafety();
        expect(guardian.emergencyStopActive).toBe(false);
    });

    it('logs a veto incident once per request and reason', () => {
        const incidents: SafetyIncident[] = [];
        const source = new FakeSource(snapshot(new FakeWorld()));
        const guardian = new GuardianHook({
            source,
            logger,
            incidentSink: { record: (incident) => incidents.push(incident) },
        });
        guardian.evaluate({ kind: 'wait', milliseconds: 1 });
        const request = { kind: 'break-block', position: { x: 1, y: 64, z: 0 } } as const;

        guardian.recordVeto(request, 'blocked by test');
        guardian.recordVeto(request, 'blocked by test');

        expect(incidents.length).toBe(1);
        expect(incidents[0]?.kind).toBe('veto.break-block');
        expect(incidents[0]?.action?.kind).toBe('break-block');
    });
});

import type { Result, Vec3 } from '@ticrafter/core';
import type { SafetySnapshot } from '@ticrafter/safety';
import type { SkillHostile } from '@ticrafter/skills';

import type { FakeInventory } from './fake-inventory.js';
import type { FakeWorld } from './fake-world.js';

export interface SafetySnapshotOptions {
    botId: string;
    at: string;
    position: Vec3;
    health: number;
    food: number;
    inventory: FakeInventory;
    world: FakeWorld;
    hostiles?: readonly SkillHostile[];
    activeSkillId?: string | null;
    stuckMilliseconds?: number;
    targetUnreachableMilliseconds?: number;
}

export class FakeSafetySource {
    constructor(private readonly readSnapshot: () => Result<SafetySnapshot, string>) {}

    read(): Result<SafetySnapshot, string> {
        return this.readSnapshot();
    }
}

export class FakeSafetySnapshots {
    static create(options: SafetySnapshotOptions): SafetySnapshot {
        const inventory = options.inventory.items();
        return {
            botId: options.botId,
            at: options.at,
            position: { ...options.position },
            health: options.health,
            food: options.food,
            oxygen: 20,
            onGround: true,
            stuckMilliseconds: options.stuckMilliseconds ?? 0,
            targetUnreachableMilliseconds: options.targetUnreachableMilliseconds ?? 0,
            inventory,
            inventoryUsedSlots: inventory.length,
            inventoryTotalSlots: 36,
            hostiles: options.hostiles ?? [],
            activeSkillId: options.activeSkillId ?? null,
            claimTrackingEnabled: true,
            allowDestructiveMaterials: false,
            world: options.world,
        };
    }
}

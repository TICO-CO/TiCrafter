import type { Result, Vec3 } from '@ticrafter/core';
import type {
    SafetyActiveBot,
    SafetyClaim,
    SafetySnapshot,
    SafetyWorldView,
} from '@ticrafter/safety';
import type { Bot } from 'mineflayer';

import type { WorldCacheAdapter } from './world-cache.js';

const MOVEMENT_SKILLS = new Set(['navigate', 'follow-path', 'flee-defend']);

const HOSTILE_MOBS = new Set([
    'blaze',
    'creeper',
    'drowned',
    'enderman',
    'husk',
    'phantom',
    'pillager',
    'skeleton',
    'slime',
    'spider',
    'stray',
    'witch',
    'wither_skeleton',
    'zombie',
    'zombie_villager',
]);

class BotSafetyWorld implements SafetyWorldView {
    constructor(private readonly world: WorldCacheAdapter) {}

    blockAt(position: Vec3): string | null {
        return this.world.blockAt(position);
    }

    isProtected(position: Vec3): boolean {
        return false;
    }

    activeBots(): readonly SafetyActiveBot[] {
        return [];
    }

    claimFor(botId: string): SafetyClaim | null {
        return null;
    }
}

export class SafetySnapshotSource {
    private world: BotSafetyWorld | null = null;
    private lastPosition: Vec3 | null = null;
    private lastMovementAt = Date.now();
    private lastActiveSkillId: string | null = null;

    constructor(
        private readonly bot: Bot,
        private readonly worldCache: WorldCacheAdapter,
        private readonly activeSkillId: () => string | null,
    ) {}

    read(): Result<SafetySnapshot, string> {
        const position = this.position();
        const now = Date.now();
        this.trackMovement(position, now);
        const skillId = this.activeSkillId();
        const inventory = this.bot.inventory.items();
        this.world ??= new BotSafetyWorld(this.worldCache);
        return [
            {
                botId: `bot.${this.bot.username.toLowerCase()}`,
                at: new Date(now).toISOString(),
                position,
                health: Number(this.bot.health ?? 0),
                food: Number(this.bot.food ?? 0),
                oxygen: Number(this.bot.oxygenLevel ?? 20),
                onGround: this.bot.entity?.onGround ?? false,
                stuckMilliseconds: this.stuckMilliseconds(skillId, now),
                targetUnreachableMilliseconds: 0,
                inventory: inventory.map((item) => ({ name: item.name, count: item.count })),
                inventoryUsedSlots: inventory.length,
                inventoryTotalSlots: this.bot.inventory.slots.length,
                nearestHostileDistance: this.nearestHostileDistance(position),
                activeSkillId: skillId,
                claimTrackingEnabled: false,
                allowDestructiveMaterials: false,
                world: this.world,
            },
            null,
        ];
    }

    private position(): Vec3 {
        const position = this.bot.entity?.position ?? { x: 0, y: 0, z: 0 };
        return { x: position.x, y: position.y, z: position.z };
    }

    private trackMovement(position: Vec3, now: number): void {
        if (this.lastPosition !== null && this.distance(this.lastPosition, position) > 0.05) {
            this.lastMovementAt = now;
        }
        this.lastPosition = position;
    }

    private stuckMilliseconds(skillId: string | null, now: number): number {
        if (skillId === null || !MOVEMENT_SKILLS.has(skillId)) {
            this.lastActiveSkillId = skillId;
            this.lastMovementAt = now;
            return 0;
        }
        if (this.lastActiveSkillId !== skillId) this.lastMovementAt = now;
        this.lastActiveSkillId = skillId;
        return now - this.lastMovementAt;
    }

    private nearestHostileDistance(position: Vec3): number | null {
        const distances = Object.values(this.bot.entities)
            .filter((entity) => entity.name !== undefined && HOSTILE_MOBS.has(entity.name))
            .map((entity) =>
                this.distance(position, {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z,
                }),
            );
        if (distances.length === 0) return null;
        return distances.reduce((nearest, current) => Math.min(nearest, current));
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}

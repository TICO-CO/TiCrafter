import type { Result, Vec3 } from '@ticrafter/core';
import type {
    SafetyActiveBot,
    SafetyClaim,
    SafetyClaimRegion,
    SafetyGrantRegion,
    SafetySnapshot,
    SafetyWorldView,
} from '@ticrafter/safety';
import type { Bot } from 'mineflayer';

import { HostileScanner } from './hostile-scanner.js';
import type { WorldCacheAdapter } from './world-cache.js';

const MOVEMENT_SKILLS = new Set([
    'navigate',
    'follow-path',
    'flee-defend',
    'explore',
    'bridge',
    'place-build',
    'repair',
    'clear',
    'harvest-farm',
    'plant-farm',
    'procurement',
    'smelt',
    'deposit',
    'withdraw',
]);

const UNREACHABLE_FAILURE_CLASSES = new Set(['no-path', 'timeout']);
const INVENTORY_TOTAL_SLOTS = 36;
const FALLING_THRESHOLD = 1.5;
const STUCK_MOVEMENT_THRESHOLD = 0.05;

export interface SafetyBounds {
    min: Vec3;
    max: Vec3;
}

export interface SafetySnapshotSourceOptions {
    botNames?: readonly string[];
    allowDestructiveMaterials?: boolean;
    failureSource?: () => { class: string; at: string } | null;
    claimSource?: () => SafetyClaim | null;
    claimsSource?: () => readonly SafetyClaimRegion[];
    grantsSource?: () => readonly SafetyGrantRegion[];
    protectedBounds?: () => SafetyBounds | null;
}

class BotSafetyWorld implements SafetyWorldView {
    constructor(
        private readonly world: WorldCacheAdapter,
        private readonly activeBotsProvider: () => readonly SafetyActiveBot[],
        private readonly claimProvider: () => SafetyClaim | null,
        private readonly claimsProvider: () => readonly SafetyClaimRegion[],
        private readonly grantsProvider: () => readonly SafetyGrantRegion[],
        private readonly boundsProvider: () => SafetyBounds | null,
    ) {}

    blockAt(position: Vec3): string | null {
        return this.world.blockAt(position);
    }

    isProtected(position: Vec3): boolean {
        const bounds = this.boundsProvider();
        if (bounds === null) return false;
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
        );
    }

    activeBots(): readonly SafetyActiveBot[] {
        return this.activeBotsProvider();
    }

    claimFor(botId: string): SafetyClaim | null {
        return this.claimProvider();
    }

    claims(): readonly SafetyClaimRegion[] {
        return this.claimsProvider();
    }

    grants(): readonly SafetyGrantRegion[] {
        return this.grantsProvider();
    }
}

export class SafetySnapshotSource {
    private world: BotSafetyWorld | null = null;
    private lastPosition: Vec3 | null = null;
    private lastMovementAt = Date.now();
    private lastActiveSkillId: string | null = null;
    private readonly hostileScanner: HostileScanner;

    constructor(
        private readonly bot: Bot,
        private readonly worldCache: WorldCacheAdapter,
        private readonly activeSkillId: () => string | null,
        private readonly options: SafetySnapshotSourceOptions = {},
    ) {
        this.hostileScanner = new HostileScanner(bot, worldCache);
    }

    read(): Result<SafetySnapshot, string> {
        const position = this.position();
        const now = Date.now();
        this.trackMovement(position, now);
        const skillId = this.activeSkillId();
        const inventory = this.bot.inventory.items();
        const fallDistance = this.fallDistance();
        this.world ??= new BotSafetyWorld(
            this.worldCache,
            () => this.detectActiveBots(),
            () => this.options.claimSource?.() ?? null,
            () => this.options.claimsSource?.() ?? [],
            () => this.options.grantsSource?.() ?? [],
            () => this.options.protectedBounds?.() ?? null,
        );
        return [
            {
                botId: `bot.${this.bot.username.toLowerCase()}`,
                at: new Date(now).toISOString(),
                position,
                health: Number(this.bot.health ?? 0),
                food: Number(this.bot.food ?? 0),
                oxygen: Number(this.bot.oxygenLevel ?? 20),
                onGround: this.bot.entity?.onGround ?? false,
                ...(fallDistance === null ? {} : { fallDistance }),
                falling: fallDistance !== null && fallDistance > FALLING_THRESHOLD,
                stuckMilliseconds: this.stuckMilliseconds(skillId, now),
                targetUnreachableMilliseconds: this.targetUnreachableMilliseconds(now),
                inventory: inventory.map((item) => ({ name: item.name, count: item.count })),
                inventoryUsedSlots: inventory.length,
                inventoryTotalSlots: INVENTORY_TOTAL_SLOTS,
                hostiles: this.hostileScanner.scan(position),
                activeSkillId: skillId,
                claimTrackingEnabled: this.options.claimSource !== undefined,
                allowDestructiveMaterials: this.options.allowDestructiveMaterials ?? false,
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
        if (
            this.lastPosition !== null &&
            this.distance(this.lastPosition, position) > STUCK_MOVEMENT_THRESHOLD
        ) {
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

    private targetUnreachableMilliseconds(now: number): number {
        const failure = this.options.failureSource?.() ?? null;
        if (failure === null || !UNREACHABLE_FAILURE_CLASSES.has(failure.class)) return 0;
        const failedAt = Date.parse(failure.at);
        if (!Number.isFinite(failedAt)) return 0;
        return Math.max(0, now - failedAt);
    }

    private fallDistance(): number | null {
        const value = (this.bot.entity as { fallDistance?: unknown } | null | undefined)
            ?.fallDistance;
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        return value;
    }

    private detectActiveBots(): readonly SafetyActiveBot[] {
        const configured = new Set((this.options.botNames ?? []).map((name) => name.toLowerCase()));
        if (configured.size === 0) return [];
        const self = this.bot.username.toLowerCase();
        return Object.entries(this.bot.players ?? {}).flatMap(([name, player]) => {
            const botId = name.toLowerCase();
            if (botId === self || !configured.has(botId)) return [];
            const position = player.entity?.position;
            if (position === undefined) return [];
            if (
                !Number.isFinite(position.x) ||
                !Number.isFinite(position.y) ||
                !Number.isFinite(position.z)
            ) {
                return [];
            }
            return [
                {
                    botId: `bot.${botId}`,
                    position: { x: position.x, y: position.y, z: position.z },
                },
            ];
        });
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}

import { type HostileThreatObservation, MobThreatRules, type Vec3 } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

const EYE_HEIGHT = 1.62;
const TORSO_HEIGHT = 0.9;
const SAMPLE_STEP = 0.5;

const NON_OCCLUDING_BLOCKS = new Set([
    'air',
    'bubble_column',
    'cave_air',
    'flowing_water',
    'glass',
    'glass_pane',
    'tinted_glass',
    'void_air',
    'water',
]);

interface MobProfile {
    ranged: boolean;
    attackRange: number;
}

const MELEE_PROFILE: MobProfile = { ranged: false, attackRange: 3 };
const EXPLOSIVE_PROFILE: MobProfile = { ranged: false, attackRange: 4 };
const BOW_PROFILE: MobProfile = { ranged: true, attackRange: 15 };
const CROSSBOW_PROFILE: MobProfile = { ranged: true, attackRange: 8 };
const FIREBALL_PROFILE: MobProfile = { ranged: true, attackRange: 16 };
const POTION_PROFILE: MobProfile = { ranged: true, attackRange: 10 };
const TRIDENT_PROFILE: MobProfile = { ranged: true, attackRange: 10 };

const HOSTILE_PROFILES = new Map<string, MobProfile>([
    ['blaze', FIREBALL_PROFILE],
    ['creeper', EXPLOSIVE_PROFILE],
    ['drowned', TRIDENT_PROFILE],
    ['enderman', MELEE_PROFILE],
    ['husk', MELEE_PROFILE],
    ['phantom', MELEE_PROFILE],
    ['pillager', CROSSBOW_PROFILE],
    ['skeleton', BOW_PROFILE],
    ['slime', MELEE_PROFILE],
    ['spider', MELEE_PROFILE],
    ['stray', BOW_PROFILE],
    ['witch', POTION_PROFILE],
    ['wither_skeleton', MELEE_PROFILE],
    ['zombie', MELEE_PROFILE],
    ['zombie_villager', MELEE_PROFILE],
]);

export interface HostileScannerWorld {
    blockAt(position: Vec3): string | null;
}

export interface ScannedHostile extends HostileThreatObservation {
    entityId?: number;
}

export class HostileScanner {
    constructor(
        private readonly bot: Bot,
        private readonly world: HostileScannerWorld,
    ) {}

    static isHostile(name: string | undefined): boolean {
        return name !== undefined && HOSTILE_PROFILES.has(name);
    }

    scan(position: Vec3): readonly ScannedHostile[] {
        return Object.values(this.bot.entities).flatMap((entity) => {
            const profile = HOSTILE_PROFILES.get(entity.name ?? '');
            if (profile === undefined) return [];
            const hostilePosition = {
                x: entity.position.x,
                y: entity.position.y,
                z: entity.position.z,
            };
            const distance = this.distance(position, hostilePosition);
            return [
                {
                    entityId: entity.id,
                    name: entity.name ?? 'unknown',
                    position: hostilePosition,
                    distance,
                    ranged: profile.ranged,
                    attackRange: profile.attackRange,
                    hasLineOfSight: this.hasLineOfSight(
                        position,
                        hostilePosition,
                        distance,
                        profile,
                    ),
                },
            ];
        });
    }

    private hasLineOfSight(
        position: Vec3,
        hostilePosition: Vec3,
        distance: number,
        profile: MobProfile,
    ): boolean {
        if (
            !profile.ranged ||
            distance > profile.attackRange + MobThreatRules.rangedWarningMargin
        ) {
            return false;
        }
        const eye = { x: position.x, y: position.y + EYE_HEIGHT, z: position.z };
        const torso = {
            x: hostilePosition.x,
            y: hostilePosition.y + TORSO_HEIGHT,
            z: hostilePosition.z,
        };
        const samples = Math.max(1, Math.ceil(this.distance(eye, torso) / SAMPLE_STEP));
        for (let step = 1; step < samples; step += 1) {
            const ratio = step / samples;
            const block = this.world.blockAt({
                x: Math.floor(eye.x + (torso.x - eye.x) * ratio),
                y: Math.floor(eye.y + (torso.y - eye.y) * ratio),
                z: Math.floor(eye.z + (torso.z - eye.z) * ratio),
            });
            if (block === null) return false;
            if (!this.isTransparent(block)) return false;
        }
        return true;
    }

    private isTransparent(block: string): boolean {
        return NON_OCCLUDING_BLOCKS.has(block) || block.endsWith('_glass');
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}

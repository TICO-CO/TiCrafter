import { type PerceptionCandidate, PerceptionFilter } from '@ticrafter/brains';
import type { Vec3 as CoreVec3 } from '@ticrafter/core';
import { PerceptionRateLimiter } from '@ticrafter/perception';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

const DEFAULT_FOCUS_RADIUS = 64;
const DEFAULT_SIGHTING_TTL_MILLISECONDS = 60_000;
const DEFAULT_HALF_ANGLE_RADIANS = Math.PI / 3;
const MAXIMUM_CANDIDATES = 64;
const DEFAULT_MAXIMUM_RAYCASTS_PER_TICK = 8;

const BED_PATTERN = /_bed$/;

export interface SightingSourceOptions {
    focusRadius?: number;
    sightingTtlMilliseconds?: number;
    halfAngleRadians?: number;
    maxRaycastsPerTick?: number;
}

export class SightingSource {
    private readonly filter: PerceptionFilter;
    private readonly focusRadius: number;
    private readonly maxRaycastsPerTick: number;

    constructor(
        private readonly bot: Bot,
        private readonly limiter: PerceptionRateLimiter,
        options: SightingSourceOptions = {},
    ) {
        this.focusRadius = options.focusRadius ?? DEFAULT_FOCUS_RADIUS;
        this.maxRaycastsPerTick = options.maxRaycastsPerTick ?? DEFAULT_MAXIMUM_RAYCASTS_PER_TICK;
        this.filter = new PerceptionFilter({
            focusRadius: this.focusRadius,
            sightingTtlMilliseconds:
                options.sightingTtlMilliseconds ?? DEFAULT_SIGHTING_TTL_MILLISECONDS,
            halfAngleRadians: options.halfAngleRadians ?? DEFAULT_HALF_ANGLE_RADIANS,
        });
    }

    refresh(now = Date.now()): void {
        if (!this.limiter.tryAcquire(this.bot.username)) return;
        const origin = this.origin();
        if (origin === null) return;
        const candidates = this.candidates().slice(0, this.maxRaycastsPerTick);
        this.filter.observe({
            origin,
            yaw: this.bot.entity.yaw,
            now,
            candidates,
            lineOfSight: (position) => this.canSee(position),
        });
    }

    nearestResource(kind: 'wood' | 'stone', now = Date.now()): CoreVec3 | null {
        this.refresh(now);
        const sighting = this.filter.nearest(
            [kind],
            this.origin() ?? this.bot.entity.position,
            now,
            this.focusRadius,
        );
        return sighting === null ? null : { ...sighting.position };
    }

    nearestBed(now = Date.now()): CoreVec3 | null {
        this.refresh(now);
        const sighting = this.filter.nearest(
            ['bed'],
            this.origin() ?? this.bot.entity.position,
            now,
            this.focusRadius,
        );
        return sighting === null ? null : { ...sighting.position };
    }

    private candidates(): readonly PerceptionCandidate[] {
        const blocks = this.bot.findBlocks({
            matching: (block) => SightingSource.kindFor(block.name) !== null,
            maxDistance: this.focusRadius,
            count: MAXIMUM_CANDIDATES,
        });
        return blocks.map((position) => {
            const block = this.bot.blockAt(position);
            const kind = block === null ? null : SightingSource.kindFor(block.name);
            return {
                kind: kind ?? 'unknown',
                position: { x: position.x, y: position.y, z: position.z },
            };
        });
    }

    private canSee(position: CoreVec3): boolean {
        const block = this.bot.blockAt(new Vec3(position.x, position.y, position.z));
        if (block === null) return false;
        return this.bot.canSeeBlock(block);
    }

    private origin(): CoreVec3 | null {
        const position = this.bot.entity?.position;
        if (position === undefined) return null;
        return { x: position.x, y: position.y + 1.62, z: position.z };
    }

    private static kindFor(name: string): 'wood' | 'stone' | 'container' | 'bed' | null {
        if (name.endsWith('_log') || name === 'log' || name.endsWith('_stem')) return 'wood';
        if (name === 'stone' || name === 'deepslate' || name.endsWith('_ore')) return 'stone';
        if (
            name === 'chest' ||
            name === 'trapped_chest' ||
            name === 'barrel' ||
            name === 'furnace'
        ) {
            return 'container';
        }
        if (BED_PATTERN.test(name)) return 'bed';
        return null;
    }
}

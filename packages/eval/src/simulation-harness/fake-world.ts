import type { HeadlessBlockChange, HeadlessWorldView } from '@ticrafter/bot/headless';
import type { Vec3 } from '@ticrafter/core';
import type {
    SafetyActiveBot,
    SafetyClaim,
    SafetyClaimRegion,
    SafetyGrantRegion,
    SafetyWorldView,
} from '@ticrafter/safety';
import type { SkillBBox, SkillBlock, SkillBlockState } from '@ticrafter/skills';

export type FakeTerrainKind = 'flat' | 'uneven';

export interface FakeEntity {
    id?: number;
    name: string;
    position: Vec3;
}

export interface FakeWorldOptions {
    seed: number;
    kind: FakeTerrainKind;
    min: Vec3;
    max: Vec3;
    groundY: number;
    maximumStep?: number;
    clearRegion?: { min: Vec3; max: Vec3 };
    entities?: readonly FakeEntity[];
}

const AIR = 'air';
const GROUND = 'grass_block';
const STONE = 'stone';
const DIRT = 'dirt';
const WATER = 'water';
const LAVA = 'lava';
const LOG = 'oak_log';
const LEAVES = 'oak_leaves';

export class FakeWorld implements HeadlessWorldView, SafetyWorldView {
    private readonly blocks = new Map<string, SkillBlockState>();
    private readonly listeners = new Set<(change: HeadlessBlockChange) => void>();
    private readonly protectedZones: { min: Vec3; max: Vec3 }[] = [];
    private readonly entityList: FakeEntity[] = [];
    private activeBotList: SafetyActiveBot[] = [];
    private claimList: SafetyClaimRegion[] = [];
    private grantList: SafetyGrantRegion[] = [];

    constructor(private readonly options: FakeWorldOptions) {
        this.entityList.push(...(options.entities ?? []).map((entity) => ({ ...entity })));
        this.generate();
    }

    reset(): void {
        this.blocks.clear();
        this.generate();
    }

    blockAt(position: Vec3): string | null {
        return this.blockStateAt(position)?.name ?? null;
    }

    blockStateAt(position: Vec3): SkillBlockState | null {
        if (!this.contains(position)) return null;
        return this.blocks.get(FakeWorld.key(position)) ?? { name: AIR, properties: {} };
    }

    blocksInBox(bbox: SkillBBox): readonly SkillBlock[] {
        const blocks: SkillBlock[] = [];
        for (let y = bbox.min.y; y <= bbox.max.y; y += 1) {
            for (let x = bbox.min.x; x <= bbox.max.x; x += 1) {
                for (let z = bbox.min.z; z <= bbox.max.z; z += 1) {
                    const position = { x, y, z };
                    const state = this.blockStateAt(position);
                    if (state === null || state.name === AIR) continue;
                    blocks.push({ ...state, position });
                }
            }
        }
        return blocks;
    }

    nearestBlock(names: readonly string[], maxDistance: number): Vec3 | null {
        return this.nearest(names, maxDistance);
    }

    nearestContainer(maxDistance: number): Vec3 | null {
        return this.nearest(['chest', 'trapped_chest', 'barrel', 'furnace'], maxDistance);
    }

    entities(): readonly { id?: number; name: string; position: Vec3 }[] {
        return this.entityList;
    }

    onBlockChanged(listener: (change: HeadlessBlockChange) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    applyBlock(position: Vec3, state: SkillBlockState | null): void {
        const key = FakeWorld.key(position);
        if (state === null || state.name === AIR) this.blocks.delete(key);
        else this.blocks.set(key, { name: state.name, properties: { ...state.properties } });
        const change: HeadlessBlockChange = {
            position: { ...position },
            blockId: state?.name ?? AIR,
            solid: state !== null && state.name !== AIR,
            ...(state === null ? {} : { properties: state.properties }),
        };
        this.listeners.forEach((listener) => listener(change));
    }

    isProtected(position: Vec3): boolean {
        return this.protectedZones.some(
            (zone) =>
                position.x >= zone.min.x &&
                position.x <= zone.max.x &&
                position.y >= zone.min.y &&
                position.y <= zone.max.y &&
                position.z >= zone.min.z &&
                position.z <= zone.max.z,
        );
    }

    protect(min: Vec3, max: Vec3): void {
        this.protectedZones.push({ min, max });
    }

    setActiveBots(bots: readonly SafetyActiveBot[]): void {
        this.activeBotList = [...bots];
    }

    setClaims(claims: readonly SafetyClaimRegion[]): void {
        this.claimList = [...claims];
    }

    setGrants(grants: readonly SafetyGrantRegion[]): void {
        this.grantList = [...grants];
    }

    activeBots(): readonly SafetyActiveBot[] {
        return this.activeBotList;
    }

    claimFor(botId: string): SafetyClaim | null {
        const claim = this.claimList.find((candidate) => candidate.ownerBotId === botId);
        return claim === undefined ? null : { id: claim.id, expiresAt: claim.expiresAt };
    }

    claims(): readonly SafetyClaimRegion[] {
        return this.claimList;
    }

    grants(): readonly SafetyGrantRegion[] {
        return this.grantList;
    }

    bounds(): { min: Vec3; max: Vec3 } {
        return { min: { ...this.options.min }, max: { ...this.options.max } };
    }

    private nearest(names: readonly string[], maxDistance: number): Vec3 | null {
        const patterns = names.map((name) => FakeWorld.pattern(name));
        const center = this.options.min;
        let nearest: { position: Vec3; distance: number } | null = null;
        for (const [key, state] of this.blocks) {
            if (!patterns.some((pattern) => pattern.test(state.name))) continue;
            const position = FakeWorld.position(key);
            const distance = Math.hypot(
                position.x - center.x,
                position.y - center.y,
                position.z - center.z,
            );
            if (distance > maxDistance) continue;
            if (nearest === null || distance < nearest.distance) nearest = { position, distance };
        }
        return nearest?.position ?? null;
    }

    private generate(): void {
        const { min, max, groundY, kind } = this.options;
        const maximumStep = this.options.maximumStep ?? 1;
        for (let x = min.x; x <= max.x; x += 1) {
            for (let z = min.z; z <= max.z; z += 1) {
                const step =
                    kind === 'uneven'
                        ? FakeWorld.hash(this.options.seed, x, z) % (maximumStep + 1)
                        : 0;
                const height = groundY + step;
                for (let y = min.y; y <= max.y; y += 1) {
                    const state = FakeWorld.terrain(y, height, x, z, min, max);
                    if (state !== null) this.blocks.set(FakeWorld.key({ x, y, z }), state);
                }
                this.decorate(x, height, z, min, max);
            }
        }
    }

    private decorate(x: number, height: number, z: number, min: Vec3, max: Vec3): void {
        const canopy = FakeWorld.hash(this.options.seed + 17, x, z) % 97 === 0;
        if (!canopy) return;
        if (x < min.x + 3 || x > max.x - 3 || z < min.z + 3 || z > max.z - 3) return;
        if (this.insideClearRegion({ x, y: height, z })) return;
        for (let offset = 0; offset < 4; offset += 1) {
            this.blocks.set(FakeWorld.key({ x, y: height + offset, z }), {
                name: LOG,
                properties: {},
            });
        }
        for (let dx = -2; dx <= 2; dx += 1) {
            for (let dz = -2; dz <= 2; dz += 1) {
                this.blocks.set(FakeWorld.key({ x: x + dx, y: height + 4, z: z + dz }), {
                    name: LEAVES,
                    properties: {},
                });
            }
        }
    }

    private insideClearRegion(position: Vec3): boolean {
        const region = this.options.clearRegion;
        if (region === undefined) return false;
        return (
            position.x >= region.min.x &&
            position.x <= region.max.x &&
            position.z >= region.min.z &&
            position.z <= region.max.z
        );
    }

    private contains(position: Vec3): boolean {
        const { min, max } = this.options;
        return (
            position.x >= min.x &&
            position.x <= max.x &&
            position.y >= min.y &&
            position.y <= max.y &&
            position.z >= min.z &&
            position.z <= max.z
        );
    }

    private static terrain(
        y: number,
        height: number,
        x: number,
        z: number,
        min: Vec3,
        max: Vec3,
    ): SkillBlockState | null {
        if (y >= height) return null;
        if (y === height - 1) {
            if (x <= min.x + 2 && z <= min.z + 2) return { name: WATER, properties: {} };
            if (x >= max.x - 2 && z >= max.z - 2) return { name: LAVA, properties: {} };
            return { name: GROUND, properties: {} };
        }
        if (y >= height - 3) return { name: DIRT, properties: {} };
        return { name: STONE, properties: {} };
    }

    private static key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }

    private static position(key: string): Vec3 {
        const [x, y, z] = key.split(',').map((value) => Number.parseInt(value, 10));
        return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
    }

    private static pattern(name: string): RegExp {
        const escaped = name
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*');
        return new RegExp(`^${escaped}$`);
    }

    private static hash(seed: number, x: number, z: number): number {
        let value = (seed ^ (x * 374761393) ^ (z * 668265263)) >>> 0;
        value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
        return value >>> 0;
    }
}

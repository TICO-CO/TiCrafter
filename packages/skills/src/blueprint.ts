import type { ActionRequest, Result, Vec3 } from '@ticrafter/core';

import type {
    SkillBuildTarget,
    SkillContext,
    SkillInventoryItem,
    SkillRun,
    SkillStep,
    SkillWorldView,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const AIR_BLOCK_IDS = new Set(['air', 'cave_air', 'void_air']);

export interface BlueprintState {
    targets: SkillBuildTarget[];
    cursor: number;
    activeKey: string | null;
    placed: string[];
    skipped: string[];
    workPackageId: string;
}

export class Blueprint {
    static targetKey(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }

    static blockNameAt(world: SkillWorldView, position: Vec3): string | null {
        return world.blockStateAt?.(position)?.name ?? world.blockAt(position);
    }

    static isAir(blockName: string | null): boolean {
        return blockName === null || AIR_BLOCK_IDS.has(blockName);
    }

    static expectedBlockName(target: SkillBuildTarget): string {
        return target.expectedBlockId ?? target.itemName;
    }

    static isSatisfied(world: SkillWorldView, target: SkillBuildTarget): boolean {
        const expectedName = this.expectedBlockName(target);
        const state = world.blockStateAt?.(target.position) ?? null;
        const blockName = state?.name ?? this.blockNameAt(world, target.position);
        if (blockName === null || blockName !== expectedName) return false;
        if (target.properties === undefined) return true;
        if (state === null) return false;
        return Object.entries(target.properties).every(
            ([key, value]) => state.properties[key] === value,
        );
    }

    static sortSupportFirst(
        targets: readonly SkillBuildTarget[],
        origin: Vec3,
    ): SkillBuildTarget[] {
        return [...targets].sort((left, right) => {
            if (left.position.y !== right.position.y) return left.position.y - right.position.y;
            if (left.position.x !== right.position.x) return left.position.x - right.position.x;
            if (left.position.z !== right.position.z) return left.position.z - right.position.z;
            return (
                SkillSharedUtilities.distance(left.position, origin) -
                SkillSharedUtilities.distance(right.position, origin)
            );
        });
    }

    static outstandingTargets(
        context: SkillContext,
        targets: readonly SkillBuildTarget[],
    ): SkillBuildTarget[] {
        const pending = targets.filter((target) => !this.isSatisfied(context.world, target));
        return this.sortSupportFirst(pending, context.position);
    }

    static missingMaterials(
        inventory: readonly SkillInventoryItem[],
        targets: readonly SkillBuildTarget[],
    ): string[] {
        const required = new Map<string, number>();
        targets.forEach((target) => {
            required.set(target.itemName, (required.get(target.itemName) ?? 0) + 1);
        });
        return [...required.entries()]
            .filter(
                ([itemName, count]) => SkillSharedUtilities.itemCount(inventory, itemName) < count,
            )
            .map(([itemName]) => itemName)
            .sort();
    }

    static placementAction(target: SkillBuildTarget): ActionRequest {
        return {
            kind: 'place-block',
            position: target.position,
            itemName: target.itemName,
            ...(target.expectedBlockId === undefined
                ? {}
                : { expectedBlockId: target.expectedBlockId }),
            ...(target.properties === undefined ? {} : { properties: target.properties }),
            reference: {
                x: target.position.x,
                y: target.position.y - 1,
                z: target.position.z,
            },
            face: { x: 0, y: 1, z: 0 },
        };
    }

    static begin(
        context: SkillContext,
        skillId: string,
        targets: readonly SkillBuildTarget[],
        workPackageId: string,
    ): Result<SkillStep, string> {
        const outstanding = this.outstandingTargets(context, targets);
        const run: SkillRun = {
            skillId,
            state: {
                targets: outstanding,
                cursor: 0,
                activeKey: null,
                placed: [],
                skipped: [],
                workPackageId,
            },
        };
        const missing = this.missingMaterials(context.inventory, outstanding);
        if (missing.length > 0) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'missing-item',
                    `missing build materials: ${missing.join(', ')}`,
                ),
                null,
            ];
        }
        return [this.advance(context, run), null];
    }

    static step(context: SkillContext, run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'placement state is invalid',
            );
        }
        if (context.lastAction?.status === 'failed') {
            return SkillSharedUtilities.failed(
                run,
                SkillSharedUtilities.failureClassFor(context.lastAction),
                context.lastAction.message ?? 'block placement failed',
            );
        }
        if (context.lastAction?.status === 'cancelled') {
            return SkillSharedUtilities.cancelled(run, 'block placement was cancelled');
        }
        if (context.lastAction?.status === 'completed' && state.activeKey !== null) {
            const placed = state.placed.includes(state.activeKey)
                ? state.placed
                : [...state.placed, state.activeKey];
            const nextRun: SkillRun = {
                skillId: run.skillId,
                state: {
                    ...run.state,
                    cursor: state.cursor + 1,
                    activeKey: null,
                    placed,
                },
            };
            return this.advance(context, nextRun);
        }
        if (state.activeKey !== null) {
            const target = state.targets.find(
                (candidate) => this.targetKey(candidate.position) === state.activeKey,
            );
            if (target === undefined) {
                return SkillSharedUtilities.failed(
                    run,
                    'execution-failed',
                    'placement target is missing',
                );
            }
            return SkillSharedUtilities.running(
                run,
                this.placementAction(target),
                state.placed.length,
                state.targets.length,
                `placing ${target.itemName}`,
            );
        }
        return this.advance(context, run);
    }

    static restore(skillId: string, state: Record<string, unknown>): Result<SkillRun, string> {
        const run: SkillRun = { skillId, state };
        const read = this.readState(run);
        if (read === null) return [null, 'checkpoint has an invalid placement state'];
        if (
            read.activeKey !== null &&
            !read.targets.some((target) => this.targetKey(target.position) === read.activeKey)
        ) {
            return [null, 'checkpoint has a missing placement target'];
        }
        return [run, null];
    }

    static readTargets(value: unknown): SkillBuildTarget[] | null {
        if (!Array.isArray(value)) return null;
        const targets: SkillBuildTarget[] = [];
        for (const entry of value) {
            if (!SkillSharedUtilities.isRecord(entry)) return null;
            const position = SkillSharedUtilities.readVec3(entry.position);
            const itemName = SkillSharedUtilities.readString(entry.itemName);
            if (position === null || itemName === null) return null;
            const expectedBlockId =
                SkillSharedUtilities.readString(entry.expectedBlockId) ?? undefined;
            const properties =
                entry.properties === undefined
                    ? undefined
                    : SkillSharedUtilities.readProperties(entry.properties);
            if (entry.properties !== undefined && properties === null) return null;
            targets.push({
                position,
                itemName,
                ...(expectedBlockId === undefined ? {} : { expectedBlockId }),
                ...(properties === null || properties === undefined ? {} : { properties }),
            });
        }
        return targets;
    }

    static readKeys(value: unknown): string[] | null {
        if (!Array.isArray(value)) return null;
        if (!value.every((entry) => typeof entry === 'string')) return null;
        return [...value];
    }

    private static readState(run: SkillRun): BlueprintState | null {
        const targets = this.readTargets(run.state.targets);
        const placed = this.readKeys(run.state.placed);
        const skipped = this.readKeys(run.state.skipped);
        if (targets === null || placed === null || skipped === null) return null;
        const cursor = run.state.cursor;
        if (typeof cursor !== 'number' || !Number.isInteger(cursor)) return null;
        if (cursor < 0 || cursor > targets.length) return null;
        const activeValue = run.state.activeKey;
        let activeKey: string | null = null;
        if (activeValue !== null && activeValue !== undefined) {
            activeKey = SkillSharedUtilities.readString(activeValue);
            if (activeKey === null) return null;
        }
        return {
            targets,
            cursor,
            activeKey,
            placed,
            skipped,
            workPackageId: SkillSharedUtilities.readString(run.state.workPackageId) ?? 'default',
        };
    }

    private static advance(context: SkillContext, run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'placement state is invalid',
            );
        }
        let cursor = state.cursor;
        const skipped = [...state.skipped];
        while (cursor < state.targets.length) {
            const candidate = state.targets[cursor];
            if (candidate === undefined) break;
            if (!this.isSatisfied(context.world, candidate)) break;
            const key = this.targetKey(candidate.position);
            if (!skipped.includes(key)) skipped.push(key);
            cursor += 1;
        }
        if (cursor >= state.targets.length) {
            return SkillSharedUtilities.completed(
                {
                    skillId: run.skillId,
                    state: { ...run.state, cursor, activeKey: null, skipped },
                },
                `placed ${state.placed.length} blocks`,
            );
        }
        const target = state.targets[cursor];
        if (target === undefined) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'placement target is missing',
            );
        }
        const key = this.targetKey(target.position);
        const nextRun: SkillRun = {
            skillId: run.skillId,
            state: { ...run.state, cursor, activeKey: key, skipped },
        };
        return SkillSharedUtilities.running(
            nextRun,
            this.placementAction(target),
            state.placed.length,
            state.targets.length,
            `placing ${target.itemName} at ${key}`,
        );
    }
}

import type { Result, Vec3 } from '@ticrafter/core';

import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const DEFAULT_RADIUS = 32;

export class GatherResourceSkill implements Skill {
    readonly id = 'gather-resource';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if ((input.count ?? 1) <= 0) return [null, 'gather-resource count must be positive'];
        if ((input.blockIds ?? []).length === 0) {
            return [false, null];
        }
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if ((input.blockIds ?? []).length === 0) {
            return [null, 'gather-resource requires block ids'];
        }
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const blockIds = input.blockIds ?? [];
        if (blockIds.length === 0) return [null, 'gather-resource requires block ids'];
        const run: SkillRun = {
            skillId: this.id,
            state: {
                remaining: input.count ?? 1,
                mined: 0,
                blockIds,
                radius: input.radius ?? DEFAULT_RADIUS,
                target: input.target ?? null,
                expectedBlockId: null,
                phase: 'break',
            },
        };
        return this.select(context, run, input.target ?? null);
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'gathering failed',
                ),
                null,
            ];
        }
        const phase = SkillSharedUtilities.readString(run.state.phase) ?? 'break';
        const target = SkillSharedUtilities.readVec3(run.state.target);
        if (target === null) return this.select(context, run, null);
        if (phase === 'break' && context.lastAction?.status === 'completed') {
            const next: SkillRun = { skillId: this.id, state: { ...run.state, phase: 'collect' } };
            return [this.collect(next, target), null];
        }
        if (phase === 'collect' && context.lastAction?.status === 'completed') {
            const mined = SkillSharedUtilities.readNumber(run.state.mined, 0) + 1;
            const remaining = SkillSharedUtilities.readNumber(run.state.remaining, 1) - 1;
            if (remaining <= 0) {
                return [
                    SkillSharedUtilities.completed(
                        { skillId: this.id, state: { ...run.state, mined, remaining: 0 } },
                        `gathered ${mined} resources`,
                    ),
                    null,
                ];
            }
            const next: SkillRun = {
                skillId: this.id,
                state: { ...run.state, mined, remaining, phase: 'break', target: null },
            };
            return this.select(context, next, null);
        }
        if (phase === 'collect') return [this.collect(run, target), null];
        const expectedBlockId =
            SkillSharedUtilities.readString(run.state.expectedBlockId) ?? undefined;
        return [
            SkillSharedUtilities.running(
                run,
                {
                    kind: 'break-block',
                    position: target,
                    ...(expectedBlockId === undefined ? {} : { expectedBlockId }),
                },
                SkillSharedUtilities.readNumber(run.state.mined, 0),
                SkillSharedUtilities.readNumber(run.state.mined, 0) +
                    SkillSharedUtilities.readNumber(run.state.remaining, 1),
                'breaking resource block',
            ),
            null,
        ];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        const blockIds = WorldList.read(checkpoint.state.blockIds);
        if (blockIds === null || blockIds.length === 0) {
            return [null, 'checkpoint has no resource block ids'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private select(
        context: SkillContext,
        run: SkillRun,
        requested: Vec3 | null,
    ): Result<SkillStep, string> {
        const blockIds = WorldList.read(run.state.blockIds) ?? [];
        const radius = SkillSharedUtilities.readNumber(run.state.radius, DEFAULT_RADIUS);
        const requestedBlock = requested === null ? null : context.world.blockAt(requested);
        const target =
            (requestedBlock === null || requestedBlock === 'air' || requestedBlock === 'cave_air'
                ? null
                : requested) ??
            context.world.nearestBlock?.(blockIds, radius) ??
            null;
        if (target === null) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'target-missing',
                    `no ${blockIds.join(',')} resource nearby`,
                ),
                null,
            ];
        }
        const blockId = context.world.blockAt(target);
        if (blockId === null || blockId === 'air' || blockId === 'cave_air') {
            return [
                SkillSharedUtilities.failed(run, 'target-missing', 'resource target is missing'),
                null,
            ];
        }
        const next: SkillRun = {
            skillId: this.id,
            state: { ...run.state, target, expectedBlockId: blockId, phase: 'break' },
        };
        return [
            SkillSharedUtilities.running(
                next,
                { kind: 'break-block', position: target, expectedBlockId: blockId },
                SkillSharedUtilities.readNumber(run.state.mined, 0),
                SkillSharedUtilities.readNumber(run.state.mined, 0) +
                    SkillSharedUtilities.readNumber(run.state.remaining, 1),
                'breaking resource block',
            ),
            null,
        ];
    }

    private collect(run: SkillRun, target: Vec3): SkillStep {
        return SkillSharedUtilities.running(
            run,
            { kind: 'collect-drops', radius: 4 },
            SkillSharedUtilities.readNumber(run.state.mined, 0),
            SkillSharedUtilities.readNumber(run.state.mined, 0) +
                SkillSharedUtilities.readNumber(run.state.remaining, 1),
            `collecting drops near ${target.x},${target.y},${target.z}`,
        );
    }
}

class WorldList {
    static read(value: unknown): readonly string[] | null {
        if (!Array.isArray(value)) return null;
        return value.every((entry) => typeof entry === 'string') ? value : null;
    }
}

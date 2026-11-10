import type { Result } from '@ticrafter/core';

import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

export class MineSkill implements Skill {
    readonly id = 'mine';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.target === undefined) return [null, 'mine requires a target'];
        return [true, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (input.target === undefined) return [null, 'mine requires a target'];
        const blockId = context.world.blockAt(input.target);
        if (blockId === null || blockId === 'air' || blockId === 'cave_air') {
            return [null, 'mine target is missing'];
        }
        const run: SkillRun = {
            skillId: this.id,
            state: {
                target: input.target,
                expectedBlockId: blockId,
                phase: 'break',
                radius: input.radius ?? 4,
            },
        };
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'break-block', position: input.target, expectedBlockId: blockId },
                0,
                2,
                'breaking block',
            ),
            null,
        ];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const target = SkillSharedUtilities.readVec3(run.state.target);
        if (target === null) return [null, 'mine state lost its target'];
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'mining failed',
                ),
                null,
            ];
        }
        const phase = SkillSharedUtilities.readString(run.state.phase);
        if (phase === 'collect' && context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'block mined and collected'), null];
        }
        if (phase === 'collect') {
            return [this.collect(run, target), null];
        }
        if (context.lastAction?.status === 'completed') {
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, phase: 'collect' },
            };
            return [this.collect(nextRun, target), null];
        }
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
                0,
                2,
                'breaking block',
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
        if (SkillSharedUtilities.readVec3(checkpoint.state.target) === null) {
            return [null, 'checkpoint has no mining target'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private collect(run: SkillRun, target: { x: number; y: number; z: number }): SkillStep {
        const radius = SkillSharedUtilities.readNumber(run.state.radius, 4);
        return SkillSharedUtilities.running(
            run,
            { kind: 'collect-drops', radius },
            1,
            2,
            `collecting drops near ${target.x},${target.y},${target.z}`,
        );
    }
}

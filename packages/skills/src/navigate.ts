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

export class NavigateSkill implements Skill {
    readonly id = 'navigate';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.target === undefined) return [null, 'navigate requires a target'];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (input.target === undefined) return [null, 'navigate requires a target'];
        const range = input.range ?? 1;
        const run: SkillRun = {
            skillId: this.id,
            state: { target: input.target, range },
        };
        if (SkillSharedUtilities.distance(context.position, input.target) <= range) {
            return [SkillSharedUtilities.completed(run, 'already at target'), null];
        }
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: input.target, range },
                0,
                1,
                'moving',
            ),
            null,
        ];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const target = SkillSharedUtilities.readVec3(run.state.target);
        if (target === null) return [null, 'navigate state lost its target'];
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'navigation failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'target reached'), null];
        }
        const range = SkillSharedUtilities.readNumber(run.state.range, 1);
        if (SkillSharedUtilities.distance(context.position, target) <= range) {
            return [SkillSharedUtilities.completed(run, 'target reached'), null];
        }
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: target, range },
                0,
                1,
                'moving',
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
        const target = SkillSharedUtilities.readVec3(checkpoint.state.target);
        if (target === null) return [null, 'checkpoint has no navigation target'];
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }
}

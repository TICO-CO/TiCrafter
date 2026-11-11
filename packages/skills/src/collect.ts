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

export class CollectSkill implements Skill {
    readonly id = 'collect';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const run: SkillRun = {
            skillId: this.id,
            state: {
                radius: input.radius ?? 8,
                ...(input.itemName === undefined ? {} : { itemName: input.itemName }),
            },
        };
        return [this.collect(run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'collection failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'drops collected'), null];
        }
        return [this.collect(run), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private collect(run: SkillRun): SkillStep {
        const radius = SkillSharedUtilities.readNumber(run.state.radius, 8);
        const itemName = SkillSharedUtilities.readString(run.state.itemName) ?? undefined;
        return SkillSharedUtilities.running(
            run,
            { kind: 'collect-drops', radius, ...(itemName === undefined ? {} : { itemName }) },
            0,
            1,
            'collecting drops',
        );
    }
}

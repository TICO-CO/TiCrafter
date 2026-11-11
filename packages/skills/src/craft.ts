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

export class CraftSkill implements Skill {
    readonly id = 'craft';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.itemName === undefined) return [null, 'craft requires an item name'];
        if ((input.count ?? 1) <= 0) return [null, 'craft count must be positive'];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (input.itemName === undefined) return [null, 'craft requires an item name'];
        const run: SkillRun = {
            skillId: this.id,
            state: { itemName: input.itemName, count: input.count ?? 1 },
        };
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'craft', itemName: input.itemName, count: input.count ?? 1 },
                0,
                1,
                `crafting ${input.itemName}`,
            ),
            null,
        ];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'crafting failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'craft complete'), null];
        }
        const itemName = SkillSharedUtilities.readString(run.state.itemName);
        if (itemName === null) return [null, 'craft state lost its item'];
        const count = SkillSharedUtilities.readNumber(run.state.count, 1);
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'craft', itemName, count },
                0,
                1,
                `crafting ${itemName}`,
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
        if (SkillSharedUtilities.readString(checkpoint.state.itemName) === null) {
            return [null, 'checkpoint has no craft item'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }
}

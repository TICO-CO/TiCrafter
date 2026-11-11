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

export class EatSkill implements Skill {
    readonly id = 'eat';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        const threshold = input.threshold ?? 20;
        if (context.food >= threshold) return [false, null];
        if (input.itemName !== undefined)
            return [SkillSharedUtilities.hasItem(context.inventory, input.itemName), null];
        return [SkillSharedUtilities.firstFood(context.inventory) !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const itemName = input.itemName ?? SkillSharedUtilities.firstFood(context.inventory);
        if (itemName === null) return [null, 'no food available'];
        const run: SkillRun = {
            skillId: this.id,
            state: { itemName, threshold: input.threshold ?? 20 },
        };
        return [this.consume(run, itemName), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'eating failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'food consumed'), null];
        }
        const itemName = SkillSharedUtilities.readString(run.state.itemName);
        if (itemName === null) return [null, 'eat state lost its item'];
        return [this.consume(run, itemName), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (SkillSharedUtilities.readString(checkpoint.state.itemName) === null) {
            return [null, 'checkpoint has no food item'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private consume(run: SkillRun, itemName: string): SkillStep {
        return SkillSharedUtilities.running(
            run,
            { kind: 'consume', itemName },
            0,
            1,
            `eating ${itemName}`,
        );
    }
}

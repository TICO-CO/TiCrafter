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

export class WithdrawSkill implements Skill {
    readonly id = 'withdraw';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.itemName === undefined) return [null, 'withdraw requires an item name'];
        if (input.container === undefined && context.world.nearestContainer(32) === null) {
            return [false, null];
        }
        return [true, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (input.itemName === undefined) return [null, 'withdraw requires an item name'];
        const container = input.container ?? context.world.nearestContainer(32);
        if (container === null) return [null, 'no container nearby'];
        const run: SkillRun = {
            skillId: this.id,
            state: {
                container,
                itemName: input.itemName,
                count: input.count ?? 1,
            },
        };
        return [this.transfer(run, container, input.itemName, input.count ?? 1), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'withdraw failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'withdraw complete'), null];
        }
        const container = SkillSharedUtilities.readVec3(run.state.container);
        const itemName = SkillSharedUtilities.readString(run.state.itemName);
        if (container === null || itemName === null) return [null, 'withdraw state is invalid'];
        return [
            this.transfer(
                run,
                container,
                itemName,
                SkillSharedUtilities.readNumber(run.state.count, 1),
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
        if (SkillSharedUtilities.readVec3(checkpoint.state.container) === null) {
            return [null, 'checkpoint has no container'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private transfer(
        run: SkillRun,
        container: { x: number; y: number; z: number },
        itemName: string,
        count: number,
    ): SkillStep {
        return SkillSharedUtilities.running(
            run,
            { kind: 'transfer', direction: 'withdraw', container, itemName, count },
            0,
            1,
            `withdrawing ${itemName}`,
        );
    }
}

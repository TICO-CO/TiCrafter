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

export class FleeDefendSkill implements Skill {
    readonly id = 'flee-defend';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.nearestHostile === null) return [false, null];
        return [true, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (context.nearestHostile === null) return [null, 'no hostile mob nearby'];
        const run: SkillRun = { skillId: this.id, state: {} };
        return [this.react(context, run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'flee or defend failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'survival action complete'), null];
        }
        return [this.react(context, run), null];
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

    private react(context: SkillContext, run: SkillRun): SkillStep {
        const hostile = context.nearestHostile;
        if (hostile === null) return SkillSharedUtilities.completed(run, 'threat gone');
        if (context.health < 8 || hostile.distance < 4) {
            return SkillSharedUtilities.running(
                run,
                {
                    kind: 'move-to',
                    position: SkillSharedUtilities.awayFrom(context.position, hostile.position, 10),
                    range: 1,
                },
                0,
                1,
                'fleeing',
            );
        }
        const entityId = hostile.entityId;
        return SkillSharedUtilities.running(
            run,
            {
                kind: 'attack',
                ...(entityId === undefined ? {} : { entityId }),
                entityName: hostile.name,
            },
            0,
            1,
            `defending against ${hostile.name}`,
        );
    }
}

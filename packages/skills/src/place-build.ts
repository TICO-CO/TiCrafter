import type { Result } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    Skill,
    SkillBuildTarget,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

export class PlaceBuildSkill implements Skill {
    readonly id = 'place-build';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.blocks !== undefined) return [true, null];
        if (context.services?.blueprints !== undefined) return [true, null];
        return [false, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.blocks !== undefined) return [input, null];
        if (context.services?.blueprints !== undefined) return [input, null];
        return [null, 'place-build requires blocks or a blueprint source'];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const [targets, targetError] = this.resolveTargets(context, input);
        if (targetError !== null) return [null, targetError];
        if (targets === null) {
            return [this.unsupported('place-build requires a target source'), null];
        }
        const workPackageId = input.taskId ?? context.taskId ?? 'default';
        return Blueprint.begin(context, this.id, targets, workPackageId);
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        return [Blueprint.step(context, run), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        return Blueprint.restore(this.id, checkpoint.state);
    }

    private resolveTargets(
        context: SkillContext,
        input: SkillInput,
    ): Result<readonly SkillBuildTarget[] | null, string> {
        if (input.blocks !== undefined) return [input.blocks, null];
        const blueprints = context.services?.blueprints;
        if (blueprints === undefined) return [null, null];
        return blueprints.targets(input);
    }

    private unsupported(message: string): SkillStep {
        return SkillSharedUtilities.failed({ skillId: this.id, state: {} }, 'unsupported', message);
    }
}

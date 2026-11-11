import type { Result } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

export class SchematicBuildSkill implements Skill {
    readonly id = 'schematic-build';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.schematic === undefined) return [false, null];
        if (context.services?.schematics === undefined) return [false, null];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.schematic === undefined) return [null, 'schematic-build requires a schematic'];
        if (context.services?.schematics === undefined) {
            return [null, 'schematic-build requires a schematic pipeline'];
        }
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const schematic = input.schematic;
        if (schematic === undefined) {
            return [this.unsupported('schematic-build requires a schematic'), null];
        }
        const pipeline = context.services?.schematics;
        if (pipeline === undefined) {
            return [this.unsupported('schematic pipeline is unavailable'), null];
        }
        const [targets, prepareError] = pipeline.prepare(schematic);
        if (prepareError !== null) {
            return [this.unsupported(`schematic prepare failed: ${prepareError}`), null];
        }
        if (targets === null) {
            return [this.unsupported('schematic prepare returned no targets'), null];
        }
        const [started, startError] = Blueprint.begin(context, this.id, targets, schematic.id);
        if (startError !== null) return [null, startError];
        if (started === null) return [null, 'schematic-build produced no first step'];
        return [this.decorate(started, schematic.id, schematic.revision ?? 0), null];
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
        const schematicId = SkillSharedUtilities.readString(checkpoint.state.schematicId);
        if (schematicId === null) {
            return [null, 'checkpoint has no schematic id'];
        }
        const [run, restoreError] = Blueprint.restore(this.id, checkpoint.state);
        if (restoreError !== null) return [null, restoreError];
        if (run === null) return [null, 'checkpoint has no schematic run'];
        return [run, null];
    }

    private unsupported(message: string): SkillStep {
        return SkillSharedUtilities.failed({ skillId: this.id, state: {} }, 'unsupported', message);
    }

    private decorate(step: SkillStep, schematicId: string, revision: number): SkillStep {
        return {
            ...step,
            run: {
                ...step.run,
                state: {
                    ...step.run.state,
                    schematicId,
                    schematicRevision: revision,
                },
            },
        };
    }
}

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

export class FollowPathSkill implements Skill {
    readonly id = 'follow-path';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.waypoints === undefined || input.waypoints.length === 0) {
            return [null, 'follow-path requires waypoints'];
        }
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (input.waypoints === undefined || input.waypoints.length === 0) {
            return [null, 'follow-path requires waypoints'];
        }
        const run: SkillRun = {
            skillId: this.id,
            state: { waypoints: input.waypoints, index: 0, range: input.range ?? 1 },
        };
        return [this.moveToCurrent(run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'waypoint failed',
                ),
                null,
            ];
        }
        const waypoints = this.readWaypoints(run);
        if (waypoints === null) return [null, 'follow-path state lost waypoints'];
        const index = SkillSharedUtilities.readNumber(run.state.index, 0);
        if (context.lastAction?.status === 'completed') {
            const nextIndex = index + 1;
            if (nextIndex >= waypoints.length) {
                return [SkillSharedUtilities.completed(run, 'path complete'), null];
            }
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, index: nextIndex },
            };
            return [this.moveToCurrent(nextRun), null];
        }
        return [this.moveToCurrent(run), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        const waypoints = this.readWaypoints({ skillId: this.id, state: checkpoint.state });
        if (waypoints === null) return [null, 'checkpoint has no waypoints'];
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private moveToCurrent(run: SkillRun): SkillStep {
        const waypoints = this.readWaypoints(run) ?? [];
        const index = SkillSharedUtilities.readNumber(run.state.index, 0);
        const target = waypoints[index];
        if (target === undefined) return SkillSharedUtilities.completed(run, 'path complete');
        const range = SkillSharedUtilities.readNumber(run.state.range, 1);
        return SkillSharedUtilities.running(
            run,
            { kind: 'move-to', position: target, range },
            index,
            waypoints.length,
            `waypoint ${index + 1}/${waypoints.length}`,
        );
    }

    private readWaypoints(run: SkillRun): readonly Vec3[] | null {
        if (!Array.isArray(run.state.waypoints)) return null;
        const waypoints = run.state.waypoints
            .map((value) => SkillSharedUtilities.readVec3(value))
            .filter((value): value is Vec3 => value !== null);
        return waypoints.length === 0 ? null : waypoints;
    }
}

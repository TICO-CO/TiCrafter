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

const PLACE_RANGE = 2;

export class PlaceBedSkill implements Skill {
    readonly id = 'place-bed';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (this.target(input) === null) return [null, 'place-bed requires a target'];
        return [this.bedItem(context, input) !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (this.target(input) === null) return [null, 'place-bed requires a target'];
        if (this.bedItem(context, input) === null) return [null, 'place-bed requires a bed item'];
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const target = this.target(input);
        if (target === null) return [null, 'place-bed requires a target'];
        const bedItem = this.bedItem(context, input);
        if (bedItem === null) return [null, 'place-bed requires a bed item'];
        const run: SkillRun = {
            skillId: this.id,
            state: { target, itemName: bedItem, phase: 'move' },
        };
        if (this.hasBed(context, target)) {
            return [SkillSharedUtilities.completed(run, 'bed already placed'), null];
        }
        return [this.moveOrPlace(context, run, target, bedItem), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'bed placement failed',
                ),
                null,
            ];
        }
        const target = SkillSharedUtilities.readVec3(run.state.target);
        const bedItem = SkillSharedUtilities.readString(run.state.itemName);
        if (target === null || bedItem === null) return [null, 'place-bed state is invalid'];
        if (this.hasBed(context, target)) {
            return [SkillSharedUtilities.completed(run, 'bed placed'), null];
        }
        const phase = SkillSharedUtilities.readString(run.state.phase);
        if (phase === 'move' && context.lastAction?.status === 'completed') {
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, phase: 'place' },
            };
            return [this.place(nextRun, target, bedItem), null];
        }
        if (phase === 'place' && context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'bed placed'), null];
        }
        return [this.moveOrPlace(context, run, target, bedItem), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (SkillSharedUtilities.readVec3(checkpoint.state.target) === null) {
            return [null, 'checkpoint has no bed target'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private moveOrPlace(
        context: SkillContext,
        run: SkillRun,
        target: Vec3,
        bedItem: string,
    ): SkillStep {
        if (SkillSharedUtilities.distance(context.position, target) > PLACE_RANGE) {
            return SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: target, range: PLACE_RANGE },
                0,
                2,
                'moving to bed spot',
            );
        }
        return this.place(run, target, bedItem);
    }

    private place(run: SkillRun, target: Vec3, bedItem: string): SkillStep {
        return SkillSharedUtilities.running(
            run,
            {
                kind: 'place-block',
                position: target,
                itemName: bedItem,
                reference: { x: target.x, y: target.y - 1, z: target.z },
                face: { x: 0, y: 1, z: 0 },
            },
            1,
            2,
            `placing ${bedItem}`,
        );
    }

    private hasBed(context: SkillContext, target: Vec3): boolean {
        return context.world.blockAt(target)?.endsWith('_bed') === true;
    }

    private bedItem(context: SkillContext, input: SkillInput): string | null {
        if (input.itemName !== undefined && input.itemName.endsWith('_bed')) {
            return input.itemName;
        }
        return context.inventory.find((item) => item.name.endsWith('_bed'))?.name ?? null;
    }

    private target(input: SkillInput): Vec3 | null {
        return input.target ?? input.bed ?? null;
    }
}

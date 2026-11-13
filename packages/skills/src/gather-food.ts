import type { Result } from '@ticrafter/core';

import { type EntityTarget, EntityTargeting } from './entity-targeting.js';
import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const FOOD_ANIMALS = new Set(['cow', 'pig', 'chicken', 'rabbit', 'sheep', 'salmon', 'cod']);
const MAX_ATTACKS = 20;
const APPROACH_REACH = 2;
const ATTACK_REACH = 3;
const ATTACK_COOLDOWN_MILLISECONDS = 500;

export class GatherFoodSkill implements Skill {
    readonly id = 'gather-food';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.world.entities === undefined) return [false, null];
        return [EntityTargeting.nearest(context, FOOD_ANIMALS) !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const run: SkillRun = {
            skillId: this.id,
            state: { remaining: input.count ?? 3, target: null, phase: 'find', attacks: 0 },
        };
        return [this.advance(context, run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'food gathering failed',
                ),
                null,
            ];
        }
        return [this.advance(context, run), null];
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

    private advance(context: SkillContext, run: SkillRun): SkillStep {
        const remaining = SkillSharedUtilities.readNumber(run.state.remaining, 0);
        if (this.foodCount(context) >= remaining) {
            return SkillSharedUtilities.completed(run, 'enough food');
        }
        const phase = SkillSharedUtilities.readString(run.state.phase) ?? 'find';
        if (context.lastAction?.status === 'completed') {
            return this.afterAction(context, run, phase);
        }
        return this.perform(context, run, phase);
    }

    private afterAction(context: SkillContext, run: SkillRun, phase: string): SkillStep {
        if (phase === 'move') return this.moveOrAttack(context, this.withPhase(run, 'move'));
        if (phase === 'attack') return this.afterAttack(context, run);
        if (phase === 'cooldown') return this.attackOrApproach(context, run);
        if (phase === 'collect') return this.findAndApproach(context, this.withPhase(run, 'find'));
        return this.findAndApproach(context, run);
    }

    private perform(context: SkillContext, run: SkillRun, phase: string): SkillStep {
        if (phase === 'attack' || phase === 'cooldown')
            return this.attackOrApproach(context, run);
        if (phase === 'collect') return this.collect(run);
        if (phase === 'move') return this.moveOrAttack(context, run);
        return this.findAndApproach(context, run);
    }

    private findAndApproach(context: SkillContext, run: SkillRun): SkillStep {
        const target = EntityTargeting.nearest(context, FOOD_ANIMALS);
        if (target === null)
            return SkillSharedUtilities.failed(run, 'target-missing', 'no animals found');
        const found = this.withTarget(run, target);
        if (SkillSharedUtilities.distance(context.position, target.position) > APPROACH_REACH) {
            return SkillSharedUtilities.running(
                this.withPhase(found, 'move'),
                { kind: 'move-to', position: target.position, range: APPROACH_REACH },
                0,
                1,
                'moving to animal',
            );
        }
        return this.attackOrApproach(context, found);
    }

    private moveOrAttack(context: SkillContext, run: SkillRun): SkillStep {
        const target = this.liveTarget(context, run);
        if (target === null) return this.collect(this.withPhase(run, 'collect'));
        const found = this.withTarget(run, target);
        if (SkillSharedUtilities.distance(context.position, target.position) > APPROACH_REACH) {
            return SkillSharedUtilities.running(
                this.withPhase(found, 'move'),
                { kind: 'move-to', position: target.position, range: APPROACH_REACH },
                0,
                1,
                'moving to animal',
            );
        }
        return this.attackOrApproach(context, found);
    }

    private attackOrApproach(context: SkillContext, run: SkillRun): SkillStep {
        const target = this.liveTarget(context, run);
        if (target === null) return this.collect(this.withPhase(run, 'collect'));
        const found = this.withTarget(run, target);
        if (SkillSharedUtilities.distance(context.position, target.position) > ATTACK_REACH) {
            return this.moveOrAttack(context, this.withPhase(found, 'move'));
        }
        return this.attack(found);
    }

    private attack(run: SkillRun): SkillStep {
        const target = this.target(run);
        if (target === null)
            return SkillSharedUtilities.failed(run, 'target-missing', 'no animals found');
        const attacks = SkillSharedUtilities.readNumber(run.state.attacks, 0);
        return SkillSharedUtilities.running(
            { ...run, state: { ...run.state, attacks: attacks + 1, phase: 'attack' } },
            { kind: 'attack', ...this.selector(target) },
            0,
            1,
            'attacking animal',
        );
    }

    private afterAttack(context: SkillContext, run: SkillRun): SkillStep {
        const target = this.liveTarget(context, run);
        if (target === null) return this.collect(this.withPhase(run, 'collect'));
        const found = this.withTarget(run, target);
        const attacks = SkillSharedUtilities.readNumber(run.state.attacks, 0);
        if (attacks >= MAX_ATTACKS) return this.collect(this.withPhase(found, 'collect'));
        if (SkillSharedUtilities.distance(context.position, target.position) > ATTACK_REACH) {
            return this.moveOrAttack(context, this.withPhase(found, 'move'));
        }
        return this.cooldown(found);
    }

    private cooldown(run: SkillRun): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'cooldown'),
            { kind: 'wait', milliseconds: ATTACK_COOLDOWN_MILLISECONDS },
            0,
            1,
            'waiting to strike',
        );
    }

    private liveTarget(context: SkillContext, run: SkillRun): EntityTarget | null {
        const target = this.target(run);
        if (target === null) return null;
        return EntityTargeting.refresh(context, target);
    }

    private withTarget(run: SkillRun, target: EntityTarget): SkillRun {
        return { ...run, state: { ...run.state, target } };
    }

    private collect(run: SkillRun): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'collect'),
            { kind: 'collect-drops', radius: 5 },
            0,
            1,
            'collecting food',
        );
    }

    private withPhase(run: SkillRun, phase: string): SkillRun {
        return { ...run, state: { ...run.state, phase } };
    }

    private target(run: SkillRun): EntityTarget | null {
        return SkillSharedUtilities.isRecord(run.state.target)
            ? this.readTarget(run.state.target)
            : null;
    }

    private selector(target: EntityTarget): { entityId?: number; entityName: string } {
        return target.id === undefined
            ? { entityName: target.name }
            : { entityId: target.id, entityName: target.name };
    }

    private foodCount(context: SkillContext): number {
        return context.inventory
            .filter((item) => SkillSharedUtilities.isFood(item.name))
            .reduce((total, item) => total + item.count, 0);
    }

    private readTarget(value: unknown): EntityTarget | null {
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const name = SkillSharedUtilities.readString(value.name);
        const position = SkillSharedUtilities.readVec3(value.position);
        if (name === null || position === null) return null;
        const id = typeof value.id === 'number' ? value.id : undefined;
        return id === undefined ? { name, position } : { id, name, position };
    }
}

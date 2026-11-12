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

const SHEEP_NAMES = new Set(['sheep']);
const SHEARS = 'shears';
const MAX_ATTACKS = 12;
const REACH = 2;

export class GatherWoolSkill implements Skill {
    readonly id = 'gather-wool';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.world.entities === undefined) return [false, null];
        return [EntityTargeting.nearest(context, SHEEP_NAMES) !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const run: SkillRun = {
            skillId: this.id,
            state: {
                remaining: input.count ?? 3,
                target: null,
                phase: 'find',
                attacks: 0,
                ignored: [],
            },
        };
        return [this.advance(context, run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'wool gathering failed',
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
        if (this.woolCount(context) >= remaining) {
            return SkillSharedUtilities.completed(run, 'enough wool');
        }
        const phase = SkillSharedUtilities.readString(run.state.phase) ?? 'find';
        if (context.lastAction?.status === 'completed') {
            return this.afterAction(context, run, phase);
        }
        return this.perform(context, run, phase);
    }

    private afterAction(context: SkillContext, run: SkillRun, phase: string): SkillStep {
        if (phase === 'equip') return this.moveOrUse(context, this.withPhase(run, 'move'));
        if (phase === 'move') return this.useOrAttack(context, this.withPhase(run, 'strike'));
        if (phase === 'use') return this.collect(this.ignoreTarget(run));
        if (phase === 'attack') return this.afterAttack(context, run);
        if (phase === 'collect') {
            return this.findAndApproach(context, this.resetTarget(run, 'find'));
        }
        return this.findAndApproach(context, run);
    }

    private perform(context: SkillContext, run: SkillRun, phase: string): SkillStep {
        if (phase === 'find') return this.findAndApproach(context, run);
        if (phase === 'equip') return this.equip(run);
        if (phase === 'move') return this.moveOrUse(context, run);
        if (phase === 'use') return this.use(run);
        if (phase === 'attack') return this.attack(run);
        if (phase === 'collect') return this.collect(run);
        return this.findAndApproach(context, this.withPhase(run, 'find'));
    }

    private findAndApproach(context: SkillContext, run: SkillRun): SkillStep {
        const target = EntityTargeting.nearest(context, SHEEP_NAMES, (entity) =>
            this.isIgnored(run, entity),
        );
        if (target === null)
            return SkillSharedUtilities.failed(run, 'target-missing', 'no sheep found');
        const found = { ...run, state: { ...run.state, target } };
        if (this.hasShears(context)) return this.equip(found);
        return this.moveOrUse(context, found);
    }

    private equip(run: SkillRun): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'equip'),
            { kind: 'equip', itemName: SHEARS, destination: 'hand' },
            0,
            1,
            'equipping shears',
        );
    }

    private moveOrUse(context: SkillContext, run: SkillRun): SkillStep {
        const target = SkillSharedUtilities.isRecord(run.state.target)
            ? this.readTarget(run.state.target)
            : null;
        if (target === null) return this.findAndApproach(context, this.withPhase(run, 'find'));
        if (SkillSharedUtilities.distance(context.position, target.position) > REACH) {
            return SkillSharedUtilities.running(
                this.withPhase(run, 'move'),
                { kind: 'move-to', position: target.position, range: REACH },
                0,
                1,
                'moving to sheep',
            );
        }
        return this.useOrAttack(context, run);
    }

    private useOrAttack(context: SkillContext, run: SkillRun): SkillStep {
        const target = SkillSharedUtilities.isRecord(run.state.target)
            ? this.readTarget(run.state.target)
            : null;
        if (target === null) return this.findAndApproach(context, this.withPhase(run, 'find'));
        return this.hasShears(context)
            ? this.use({ ...run, state: { ...run.state, target } })
            : this.attack({ ...run, state: { ...run.state, target } });
    }

    private use(run: SkillRun): SkillStep {
        const target = this.target(run);
        if (target === null)
            return SkillSharedUtilities.failed(run, 'target-missing', 'no sheep found');
        return SkillSharedUtilities.running(
            this.withPhase(run, 'use'),
            { kind: 'use-entity', ...this.selector(target) },
            0,
            1,
            'shearing sheep',
        );
    }

    private attack(run: SkillRun): SkillStep {
        const target = this.target(run);
        if (target === null)
            return SkillSharedUtilities.failed(run, 'target-missing', 'no sheep found');
        const attacks = SkillSharedUtilities.readNumber(run.state.attacks, 0);
        const next = { ...run, state: { ...run.state, attacks: attacks + 1, phase: 'attack' } };
        return SkillSharedUtilities.running(
            next,
            { kind: 'attack', ...this.selector(target) },
            0,
            1,
            'attacking sheep',
        );
    }

    private afterAttack(context: SkillContext, run: SkillRun): SkillStep {
        const attacks = SkillSharedUtilities.readNumber(run.state.attacks, 0);
        const target = this.target(run);
        if (target === null) return this.collect(this.withPhase(run, 'collect'));
        if (attacks < MAX_ATTACKS && EntityTargeting.exists(context, target)) {
            return this.attack(this.withPhase(run, 'attack'));
        }
        return this.collect(this.ignoreTarget(run));
    }

    private collect(run: SkillRun): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'collect'),
            { kind: 'collect-drops', radius: 5 },
            0,
            1,
            'collecting wool',
        );
    }

    private withPhase(run: SkillRun, phase: string): SkillRun {
        return { ...run, state: { ...run.state, phase } };
    }

    private ignoreTarget(run: SkillRun): SkillRun {
        const target = this.target(run);
        const ignored = this.readIgnored(run.state.ignored);
        const key = target === null ? null : this.targetKey(target);
        const nextIgnored = key === null || ignored.includes(key) ? ignored : [...ignored, key];
        return {
            ...run,
            state: {
                ...run.state,
                ignored: nextIgnored,
                target: null,
                attacks: 0,
                phase: 'collect',
            },
        };
    }

    private resetTarget(run: SkillRun, phase: string): SkillRun {
        return {
            ...run,
            state: { ...run.state, target: null, attacks: 0, phase },
        };
    }

    private isIgnored(run: SkillRun, target: EntityTarget): boolean {
        return this.readIgnored(run.state.ignored).includes(this.targetKey(target));
    }

    private readIgnored(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        return value.filter((entry): entry is string => typeof entry === 'string');
    }

    private targetKey(target: EntityTarget): string {
        return target.id === undefined ? target.name : `id:${target.id}`;
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

    private hasShears(context: SkillContext): boolean {
        return context.inventory.some((item) => item.name === SHEARS);
    }

    private woolCount(context: SkillContext): number {
        return context.inventory
            .filter((item) => item.name.endsWith('_wool'))
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

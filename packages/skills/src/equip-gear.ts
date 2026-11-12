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

type EquipDestination = 'hand' | 'head' | 'torso' | 'legs' | 'feet';

interface EquipTarget {
    name: string;
    destination: EquipDestination;
}

const ARMOR_DESTINATIONS: Readonly<Record<string, EquipDestination>> = {
    _helmet: 'head',
    _chestplate: 'torso',
    _leggings: 'legs',
    _boots: 'feet',
};

export class EquipGearSkill implements Skill {
    readonly id = 'equip-gear';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        return [this.targets(context).length > 0, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const run: SkillRun = {
            skillId: this.id,
            state: { targets: this.targets(context), index: 0 },
        };
        return [this.advance(run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'equip failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            const index = SkillSharedUtilities.readNumber(run.state.index, 0);
            return [this.advance({ ...run, state: { ...run.state, index: index + 1 } }), null];
        }
        return [this.advance(run), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (!Array.isArray(checkpoint.state.targets)) return [null, 'checkpoint has no gear'];
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private advance(run: SkillRun): SkillStep {
        const targets = this.readTargets(run.state.targets);
        const index = SkillSharedUtilities.readNumber(run.state.index, 0);
        const target = targets[index];
        if (target === undefined) return SkillSharedUtilities.completed(run, 'gear equipped');
        return SkillSharedUtilities.running(
            run,
            {
                kind: 'equip',
                itemName: target.name,
                destination: target.destination,
            },
            index,
            targets.length,
            `equipping ${target.name}`,
        );
    }

    private targets(context: SkillContext): EquipTarget[] {
        const armor = new Map<EquipDestination, EquipTarget>();
        for (const item of context.inventory) {
            const suffix = Object.keys(ARMOR_DESTINATIONS).find((candidate) =>
                item.name.endsWith(candidate),
            );
            if (suffix === undefined) continue;
            const destination = ARMOR_DESTINATIONS[suffix];
            if (destination === undefined) continue;
            const current = armor.get(destination);
            if (current === undefined || this.tier(item.name) > this.tier(current.name)) {
                armor.set(destination, { name: item.name, destination });
            }
        }
        const weapon = context.inventory
            .filter((item) => item.name.endsWith('_sword') || item.name.endsWith('_axe'))
            .sort((left, right) => this.tier(right.name) - this.tier(left.name))[0];
        const pieces = [...armor.values()];
        return weapon === undefined
            ? pieces
            : [{ name: weapon.name, destination: 'hand' as const }, ...pieces];
    }

    private tier(itemName: string): number {
        if (itemName.startsWith('netherite')) return 5;
        if (itemName.startsWith('diamond')) return 4;
        if (itemName.startsWith('iron')) return 3;
        if (itemName.startsWith('stone')) return 2;
        if (itemName.startsWith('golden')) return 1;
        return 0;
    }

    private readTargets(value: unknown): EquipTarget[] {
        if (!Array.isArray(value)) return [];
        return value.flatMap((entry) => {
            if (!SkillSharedUtilities.isRecord(entry)) return [];
            const name = SkillSharedUtilities.readString(entry.name);
            const destination = SkillSharedUtilities.readString(entry.destination);
            if (name === null || destination === null) return [];
            if (!this.isDestination(destination)) return [];
            return [{ name, destination }];
        });
    }

    private isDestination(value: string): value is EquipDestination {
        return (
            value === 'hand' ||
            value === 'head' ||
            value === 'torso' ||
            value === 'legs' ||
            value === 'feet'
        );
    }
}

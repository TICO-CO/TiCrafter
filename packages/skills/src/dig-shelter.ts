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

const WAIT_MILLISECONDS = 5_000;
const BUILDING_ITEMS = new Set([
    'cobblestone',
    'cobbled_deepslate',
    'dirt',
    'oak_log',
    'birch_log',
    'spruce_log',
    'oak_planks',
    'birch_planks',
    'spruce_planks',
    'dark_oak_planks',
]);

interface DugBlock {
    position: Vec3;
    name: string;
}

export class DigShelterSkill implements Skill {
    readonly id = 'dig-shelter';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.target === undefined) return [null, 'dig-shelter requires a target'];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.target === undefined) return [null, 'dig-shelter requires a target'];
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const target = input.target;
        if (target === undefined) return [null, 'dig-shelter requires a target'];
        const feetName = context.world.blockAt(target) ?? 'dirt';
        const head = { x: target.x, y: target.y + 1, z: target.z };
        const headName = context.world.blockAt(head) ?? 'dirt';
        const run: SkillRun = {
            skillId: this.id,
            state: {
                target,
                outside: this.floor(context.position),
                ledger: [
                    { position: target, name: feetName },
                    { position: head, name: headName },
                ],
                digIndex: 0,
                phase: 'dig',
                sealed: false,
                sealItem: this.sealItemFrom(context),
            },
        };
        return [this.dig(run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'dig-in failed',
                ),
                null,
            ];
        }
        const target = SkillSharedUtilities.readVec3(run.state.target);
        if (target === null) return [null, 'dig-shelter state has no target'];
        const phase = SkillSharedUtilities.readString(run.state.phase) ?? 'dig';
        const completed = context.lastAction?.status === 'completed';
        if (phase === 'dig') {
            return [completed ? this.afterDig(run, target) : this.dig(run), null];
        }
        if (phase === 'enter') {
            return [
                completed ? this.afterEnter(context, run, target) : this.enter(run, target),
                null,
            ];
        }
        if (phase === 'seal') {
            return [
                completed ? this.afterSeal(context, run, target) : this.seal(run, target),
                null,
            ];
        }
        if (phase === 'wait') {
            return [completed ? this.waitOrLeave(context, run, target) : this.wait(run), null];
        }
        if (phase === 'unseal') {
            return [completed ? this.afterUnseal(run, target) : this.unseal(run, target), null];
        }
        if (phase === 'exit') {
            return [
                completed ? this.afterExit(context, run) : this.leave(run, this.outside(run)),
                null,
            ];
        }
        if (phase === 'restore') return [this.restoreStep(context, run), null];
        return [this.restoreStep(context, this.withPhase(run, 'restore')), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (SkillSharedUtilities.readVec3(checkpoint.state.target) === null) {
            return [null, 'checkpoint has no dig target'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private afterDig(run: SkillRun, target: Vec3): SkillStep {
        const index = SkillSharedUtilities.readNumber(run.state.digIndex, 0);
        const nextIndex = index + 1;
        if (nextIndex >= 2) return this.enter(run, target);
        return this.dig({ ...run, state: { ...run.state, digIndex: nextIndex } });
    }

    private enter(run: SkillRun, target: Vec3): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'enter'),
            { kind: 'move-to', position: target, range: 1 },
            2,
            2,
            'entering shelter',
        );
    }

    private dig(run: SkillRun): SkillStep {
        const target = SkillSharedUtilities.readVec3(run.state.target);
        if (target === null)
            return SkillSharedUtilities.failed(run, 'execution-failed', 'no dig target');
        const index = SkillSharedUtilities.readNumber(run.state.digIndex, 0);
        const position = index === 0 ? target : { x: target.x, y: target.y + 1, z: target.z };
        return SkillSharedUtilities.running(
            run,
            { kind: 'break-block', position },
            index,
            2,
            'digging shelter',
        );
    }

    private afterEnter(context: SkillContext, run: SkillRun, target: Vec3): SkillStep {
        const seal = this.sealItem(run);
        if (seal === null) return this.waitOrLeave(context, run, target);
        return this.seal(run, target);
    }

    private seal(run: SkillRun, target: Vec3): SkillStep {
        const seal = this.sealItem(run);
        if (seal === null) {
            return SkillSharedUtilities.failed(run, 'missing-item', 'no blocks to seal shelter');
        }
        return SkillSharedUtilities.running(
            { ...run, state: { ...run.state, phase: 'seal', sealed: true } },
            {
                kind: 'place-block',
                position: target,
                itemName: seal,
                reference: { x: target.x, y: target.y - 1, z: target.z },
                face: { x: 0, y: 1, z: 0 },
            },
            2,
            3,
            'sealing shelter',
        );
    }

    private afterSeal(context: SkillContext, run: SkillRun, target: Vec3): SkillStep {
        return this.waitOrLeave({ ...context }, run, target);
    }

    private waitOrLeave(context: SkillContext, run: SkillRun, target: Vec3): SkillStep {
        if (context.timeOfDay !== undefined && !this.isNight(context.timeOfDay)) {
            if (run.state.sealed === true) return this.unseal(run, target);
            return this.leave(run, this.outside(run));
        }
        return this.wait(run);
    }

    private wait(run: SkillRun): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'wait'),
            { kind: 'wait', milliseconds: WAIT_MILLISECONDS },
            3,
            4,
            'waiting out the night',
        );
    }

    private unseal(run: SkillRun, target: Vec3): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'unseal'),
            { kind: 'break-block', position: target },
            3,
            4,
            'opening shelter',
        );
    }

    private leave(run: SkillRun, position: Vec3): SkillStep {
        return SkillSharedUtilities.running(
            this.withPhase(run, 'exit'),
            { kind: 'move-to', position, range: 1 },
            4,
            5,
            'leaving shelter',
        );
    }

    private afterUnseal(run: SkillRun, target: Vec3): SkillStep {
        return this.leave(run, this.outside(run));
    }

    private afterExit(context: SkillContext, run: SkillRun): SkillStep {
        return this.restoreStep(context, this.withPhase(run, 'restore'));
    }

    private restoreStep(context: SkillContext, run: SkillRun): SkillStep {
        const ledger = this.readLedger(run.state.ledger);
        const index = SkillSharedUtilities.readNumber(run.state.restoreIndex, 0);
        const dug = ledger[index];
        if (dug === undefined) return SkillSharedUtilities.completed(run, 'shelter restored');
        const itemName = this.restoreItem(context, dug.name);
        if (itemName === null) {
            return SkillSharedUtilities.failed(run, 'missing-item', 'no blocks to refill shelter');
        }
        return SkillSharedUtilities.running(
            { ...run, state: { ...run.state, phase: 'restore', restoreIndex: index + 1 } },
            {
                kind: 'place-block',
                position: dug.position,
                itemName,
                reference: { x: dug.position.x, y: dug.position.y - 1, z: dug.position.z },
                face: { x: 0, y: 1, z: 0 },
            },
            index,
            ledger.length,
            'refilling shelter',
        );
    }

    private sealItem(run: SkillRun): string | null {
        const value = run.state.sealItem;
        return typeof value === 'string' ? value : null;
    }

    private sealItemFrom(context: SkillContext): string | null {
        return context.inventory.find((item) => BUILDING_ITEMS.has(item.name))?.name ?? null;
    }

    private restoreItem(context: SkillContext, name: string): string | null {
        const exact = context.inventory.find((item) => item.name === name);
        if (exact !== undefined) return exact.name;
        return context.inventory.find((item) => BUILDING_ITEMS.has(item.name))?.name ?? null;
    }

    private readLedger(value: unknown): DugBlock[] {
        if (!Array.isArray(value)) return [];
        return value.flatMap((entry) => {
            if (!SkillSharedUtilities.isRecord(entry)) return [];
            const position = SkillSharedUtilities.readVec3(entry.position);
            const name = SkillSharedUtilities.readString(entry.name);
            if (position === null || name === null) return [];
            return [{ position, name }];
        });
    }

    private outside(run: SkillRun): Vec3 {
        return SkillSharedUtilities.readVec3(run.state.outside) ?? { x: 0, y: 64, z: 0 };
    }

    private withPhase(run: SkillRun, phase: string): SkillRun {
        return { ...run, state: { ...run.state, phase } };
    }

    private floor(position: Vec3): Vec3 {
        return { x: Math.floor(position.x), y: Math.floor(position.y), z: Math.floor(position.z) };
    }

    private isNight(timeOfDay: number): boolean {
        const normalized = ((timeOfDay % 24_000) + 24_000) % 24_000;
        return normalized < 6_000 || normalized >= 19_500;
    }
}

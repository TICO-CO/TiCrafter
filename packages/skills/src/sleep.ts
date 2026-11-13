import { DayCycle, MobThreatRules, type Result, type Vec3 } from '@ticrafter/core';

import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const SLEEP_TIMEOUT_MILLISECONDS = 60_000;
const SLEEP_WAIT_MILLISECONDS = 1_000;
const SLEEP_RANGE = 2;
const BED_BLOCK_NAMES = ['*_bed'];

export class SleepSkill implements Skill {
    readonly id = 'sleep';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        const bed = this.resolveBed(context, input);
        if (bed === null) return [null, 'sleep requires a bed'];
        if (context.isSleeping === true) return [true, null];
        if (this.isDaytime(context)) return [false, null];
        if (this.isThreatened(context)) return [false, null];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (this.resolveBed(context, input) === null) return [null, 'sleep requires a bed'];
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const bed = this.resolveBed(context, input);
        if (bed === null) return [null, 'sleep requires a bed'];
        const run: SkillRun = {
            skillId: this.id,
            state: { bed, phase: 'move', startedAt: context.at, attempts: 0, range: SLEEP_RANGE },
        };
        if (context.isSleeping === true) {
            return [SkillSharedUtilities.completed(run, 'already sleeping'), null];
        }
        if (this.isThreatened(context)) {
            return [
                SkillSharedUtilities.failed(run, 'unsafe', 'hostile nearby prevents sleep'),
                null,
            ];
        }
        if (SkillSharedUtilities.distance(context.position, bed) <= SLEEP_RANGE) {
            return [this.useBed(run, bed), null];
        }
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: bed, range: SLEEP_RANGE },
                0,
                2,
                'moving to bed',
            ),
            null,
        ];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'sleep failed',
                ),
                null,
            ];
        }
        if (context.isSleeping === true) {
            return [SkillSharedUtilities.completed(run, 'sleeping'), null];
        }
        const timeout = this.timeoutStep(context, run);
        if (timeout !== null) return [timeout, null];
        const bed = SkillSharedUtilities.readVec3(run.state.bed);
        if (bed === null) return [null, 'sleep state lost its bed'];
        const phase = SkillSharedUtilities.readString(run.state.phase);
        if (phase === 'move') return this.moveStep(context, run, bed);
        if (phase === 'use') return this.useStep(context, run, bed);
        if (phase === 'wait') return this.waitStep(context, run, bed);
        if (phase === null) return [null, 'sleep state lost its phase'];
        return [null, `sleep state has unknown phase ${phase}`];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (SkillSharedUtilities.readVec3(checkpoint.state.bed) === null) {
            return [null, 'checkpoint has no bed'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private resolveBed(context: SkillContext, input: SkillInput): Vec3 | null {
        if (input.bed !== undefined) return input.bed;
        if (context.world.nearestBlock === undefined) return null;
        return context.world.nearestBlock(BED_BLOCK_NAMES, 32);
    }

    private isDaytime(context: SkillContext): boolean {
        return DayCycle.isDaytime(context.timeOfDay);
    }

    private isThreatened(context: SkillContext): boolean {
        return context.hostiles.some((hostile) => MobThreatRules.isCritical(hostile));
    }

    private moveStep(context: SkillContext, run: SkillRun, bed: Vec3): Result<SkillStep, string> {
        if (
            context.lastAction?.status === 'completed' ||
            SkillSharedUtilities.distance(context.position, bed) <= SLEEP_RANGE
        ) {
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, phase: 'use' },
            };
            return [this.useBed(nextRun, bed), null];
        }
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: bed, range: SLEEP_RANGE },
                0,
                2,
                'moving to bed',
            ),
            null,
        ];
    }

    private useStep(context: SkillContext, run: SkillRun, bed: Vec3): Result<SkillStep, string> {
        if (context.lastAction?.status !== 'completed') {
            if (this.isThreatened(context)) {
                return [
                    SkillSharedUtilities.failed(run, 'unsafe', 'hostile nearby prevents sleep'),
                    null,
                ];
            }
            return [this.useBed(run, bed), null];
        }
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, phase: 'wait', attempts: this.attempts(run) + 1 },
        };
        return [
            SkillSharedUtilities.running(
                nextRun,
                { kind: 'wait', milliseconds: SLEEP_WAIT_MILLISECONDS },
                1,
                2,
                'waiting for sleep',
            ),
            null,
        ];
    }

    private waitStep(context: SkillContext, run: SkillRun, bed: Vec3): Result<SkillStep, string> {
        if (context.lastAction?.status !== 'completed') {
            return [
                SkillSharedUtilities.running(
                    run,
                    { kind: 'wait', milliseconds: SLEEP_WAIT_MILLISECONDS },
                    1,
                    2,
                    'waiting for sleep',
                ),
                null,
            ];
        }
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, phase: 'use' },
        };
        return [this.useBed(nextRun, bed), null];
    }

    private useBed(run: SkillRun, bed: Vec3): SkillStep {
        return SkillSharedUtilities.running(
            run,
            { kind: 'use-block', position: bed },
            1,
            2,
            'using bed',
        );
    }

    private attempts(run: SkillRun): number {
        return SkillSharedUtilities.readNumber(run.state.attempts, 0);
    }

    private timeoutStep(context: SkillContext, run: SkillRun): SkillStep | null {
        const startedAt = SkillSharedUtilities.readString(run.state.startedAt);
        if (startedAt === null) return null;
        const startedMilliseconds = Date.parse(startedAt);
        const currentMilliseconds = Date.parse(context.at);
        if (Number.isNaN(startedMilliseconds) || Number.isNaN(currentMilliseconds)) return null;
        if (currentMilliseconds - startedMilliseconds < SLEEP_TIMEOUT_MILLISECONDS) return null;
        return SkillSharedUtilities.failed(run, 'timeout', 'sleep timed out');
    }
}

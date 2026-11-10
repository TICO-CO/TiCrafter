import type { ActionDispatchPort, ActionOutcome, Result } from '@ticrafter/core';

import type { CheckpointManager } from './checkpoint-manager.js';
import type { EffectsEmitter } from './effects-emitter.js';
import type { ProgressReporter } from './progress-reporter.js';
import type { SkillRegistry } from './registry.js';
import type { Skill, SkillContext, SkillInput, SkillRun, SkillStep } from './types.js';

interface ActiveSkill {
    skill: Skill;
    run: SkillRun;
    handleId: string | null;
}

export interface LifecycleOptions {
    registry: SkillRegistry;
    dispatch: ActionDispatchPort;
    effects: EffectsEmitter;
    reporter?: ProgressReporter;
    checkpoints?: CheckpointManager;
}

export class SkillLifecycleExecutor {
    private active: ActiveSkill | null = null;

    constructor(private readonly options: LifecycleOptions) {}

    start(skillId: string, input: SkillInput, context: SkillContext): Result<SkillStep, string> {
        if (this.active !== null) return [null, 'a skill is already active'];
        const [skill, resolveError] = this.options.registry.resolve(skillId);
        if (resolveError) return [null, resolveError];
        if (skill === null) return [null, `skill ${skillId} resolved null`];
        const [canRun, canRunError] = skill.canRun(context, input);
        if (canRunError) return [null, canRunError];
        if (canRun !== true) return [null, `skill ${skillId} cannot run`];
        const [step, startError] = skill.start(context, input);
        if (startError) return [null, startError];
        if (step === null) return [null, `skill ${skillId} start returned null`];
        this.active = { skill, run: step.run, handleId: null };
        const [applied, applyError] = this.applyStep(step, context);
        if (applyError) {
            this.active = null;
            return [null, applyError];
        }
        return [applied, null];
    }

    advance(context: SkillContext): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        if (this.active.handleId !== null) {
            const [outcome, pollError] = this.options.dispatch.poll(this.active.handleId);
            if (pollError) return [null, pollError];
            if (outcome === null) return [null, null];
            return this.continueAfterAction(outcome, context);
        }
        return this.stepActive(context);
    }

    cancel(context: SkillContext, reason: string): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        if (this.active.handleId !== null) {
            const [, cancelError] = this.options.dispatch.cancel(this.active.handleId);
            if (cancelError) return [null, cancelError];
        }
        const [step, cancelStepError] = this.active.skill.cancel(context, this.active.run, reason);
        this.active = null;
        if (cancelStepError) return [null, cancelStepError];
        if (step === null) return [null, null];
        if (this.options.reporter) {
            const [, reportError] = this.options.reporter.report(
                context.botId,
                context.at,
                step,
                step.status,
            );
            if (reportError) return [null, reportError];
        }
        return [step, null];
    }

    checkpoint(context: SkillContext): Result<void, string> {
        if (this.active === null || this.options.checkpoints === undefined) {
            return [undefined, null];
        }
        const [checkpoint, checkpointError] = this.active.skill.checkpoint(
            context,
            this.active.run,
        );
        if (checkpointError) return [null, checkpointError];
        if (checkpoint === null) return [null, 'skill checkpoint returned null'];
        return this.options.checkpoints.save(checkpoint);
    }

    get activeSkillId(): string | null {
        return this.active?.skill.id ?? null;
    }

    get currentRun(): SkillRun | null {
        return this.active?.run ?? null;
    }

    private continueAfterAction(
        outcome: ActionOutcome,
        context: SkillContext,
    ): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        this.active.handleId = null;
        return this.stepActive({ ...context, lastAction: outcome });
    }

    private stepActive(context: SkillContext): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        const [step, stepError] = this.active.skill.step(context, this.active.run);
        if (stepError) return [null, stepError];
        if (step === null) return [null, 'skill step returned null'];
        this.active.run = step.run;
        const [applied, applyError] = this.applyStep(step, context);
        if (applyError) {
            this.active = null;
            return [null, applyError];
        }
        if (applied === null) return [null, 'skill step returned null'];
        return [applied, null];
    }

    private applyStep(step: SkillStep, context: SkillContext): Result<SkillStep, string> {
        if (step.action !== null) {
            const [action, effectError] = this.options.effects.emit(step.action);
            if (effectError) return [null, effectError];
            if (action === null) return [null, 'effect emitter returned null'];
            const [handleId, dispatchError] = this.options.dispatch.dispatch(action);
            if (dispatchError) {
                this.active = null;
                return [null, dispatchError];
            }
            if (handleId === null) {
                this.active = null;
                return [null, 'action dispatch returned null'];
            }
            if (this.active !== null) this.active.handleId = handleId;
        }
        if (step.status !== 'running') this.active = null;
        const [, reportError] = this.options.reporter?.report(
            context.botId,
            context.at,
            step,
            step.status,
        ) ?? [undefined, null];
        if (reportError) return [null, reportError];
        const [, checkpointError] = this.checkpoint(context);
        if (checkpointError) return [null, checkpointError];
        return [step, null];
    }
}

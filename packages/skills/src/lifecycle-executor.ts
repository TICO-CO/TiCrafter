import type { ActionDispatchPort, ActionOutcome, Result } from '@ticrafter/core';

import type { CheckpointManager } from './checkpoint-manager.js';
import type { EffectsEmitter } from './effects-emitter.js';
import type { ProgressReporter } from './progress-reporter.js';
import type { SkillRegistry } from './registry.js';
import type { RestoreValidator } from './restore-validator.js';
import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';

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
    restoreValidator?: RestoreValidator;
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
        const [plannedInput, planError] = skill.plan(context, input);
        if (planError) return [null, planError];
        if (plannedInput === null) return [null, `skill ${skillId} plan returned null`];
        const [step, startError] = skill.start(context, plannedInput);
        if (startError) {
            this.active = null;
            return [null, startError];
        }
        if (step === null) {
            this.active = null;
            return [null, `skill ${skillId} start returned null`];
        }
        this.active = { skill, run: step.run, handleId: null };
        return this.applyStep(step, context);
    }

    resume(
        skillId: string,
        checkpoint: SkillCheckpoint,
        context: SkillContext,
    ): Result<SkillStep, string> {
        if (this.active !== null) return [null, 'a skill is already active'];
        const [skill, resolveError] = this.options.registry.resolve(skillId);
        if (resolveError) return [null, resolveError];
        if (skill === null) return [null, `skill ${skillId} resolved null`];
        if (this.options.restoreValidator !== undefined) {
            const [valid, validationError] = this.options.restoreValidator.validate(
                checkpoint,
                context,
            );
            if (validationError) return [null, validationError];
            if (valid !== true) return [null, `checkpoint for ${skillId} is stale`];
        }
        const [run, restoreError] = skill.restore(context, checkpoint);
        if (restoreError) return [null, restoreError];
        if (run === null) return [null, `skill ${skillId} restore returned null`];
        this.active = { skill, run, handleId: null };
        const [step, stepError] = skill.step(context, run);
        if (stepError) {
            this.active = null;
            return [null, stepError];
        }
        if (step === null) {
            this.active = null;
            return [null, `skill ${skillId} step returned null`];
        }
        return this.applyStep(step, context);
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
        return this.finish(context, reason, 'cancelled');
    }

    preempt(context: SkillContext, reason: string): Result<SkillStep | null, string> {
        return this.finish(context, reason, 'preempted');
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

    private finish(
        context: SkillContext,
        reason: string,
        failureClass: 'cancelled' | 'preempted',
    ): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        const [, checkpointError] = this.checkpoint(context);
        if (checkpointError) return [null, checkpointError];
        if (this.active.handleId !== null) {
            const [, cancelError] = this.options.dispatch.cancel(this.active.handleId);
            if (cancelError) return [null, cancelError];
        }
        const [step, cancelStepError] = this.active.skill.cancel(context, this.active.run, reason);
        this.active = null;
        if (cancelStepError) return [null, cancelStepError];
        if (step === null) return [null, null];
        const finishedStep: SkillStep = {
            ...step,
            failure:
                step.failure === null
                    ? { class: failureClass, message: reason }
                    : { ...step.failure, class: failureClass },
        };
        return this.report(context, finishedStep);
    }

    private continueAfterAction(
        outcome: ActionOutcome,
        context: SkillContext,
    ): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        this.active.handleId = null;
        if (outcome.status === 'cancelled') {
            return this.finish(context, outcome.message ?? 'action cancelled', 'cancelled');
        }
        return this.stepActive({ ...context, lastAction: outcome });
    }

    private stepActive(context: SkillContext): Result<SkillStep | null, string> {
        if (this.active === null) return [null, null];
        const [step, stepError] = this.active.skill.step(context, this.active.run);
        if (stepError) return [null, stepError];
        if (step === null) return [null, 'skill step returned null'];
        return this.applyStep(step, context);
    }

    private applyStep(step: SkillStep, context: SkillContext): Result<SkillStep, string> {
        this.active = this.active === null ? null : { ...this.active, run: step.run };
        if (step.action !== null) {
            const [action, effectError] = this.options.effects.emit(step.action);
            if (effectError) {
                this.active = null;
                return [null, effectError];
            }
            if (action === null) {
                this.active = null;
                return [null, 'effect emitter returned null'];
            }
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
        if (step.status !== 'running') {
            this.active = null;
            const [, deleteError] = this.deleteCheckpoint(context, step.run.skillId);
            if (deleteError) return [null, deleteError];
        }
        const [reported, reportError] = this.report(context, step);
        if (reportError) return [null, reportError];
        if (reported === null) return [null, 'skill report returned null'];
        if (step.status === 'running') {
            const [, checkpointError] = this.checkpoint(context);
            if (checkpointError) return [null, checkpointError];
        }
        return [step, null];
    }

    private deleteCheckpoint(context: SkillContext, skillId: string): Result<void, string> {
        if (this.options.checkpoints === undefined) return [undefined, null];
        return this.options.checkpoints.delete(context.botId, context.taskId ?? 'default', skillId);
    }

    private report(context: SkillContext, step: SkillStep): Result<SkillStep, string> {
        const [reported, reportError] = this.options.reporter?.report(
            context.botId,
            context.at,
            step,
            step.status,
            context.taskId,
        ) ?? [undefined, null];
        if (reportError) return [null, reportError];
        if (reported === null) return [null, 'skill report returned null'];
        return [step, null];
    }
}

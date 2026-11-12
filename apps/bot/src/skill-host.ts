import type { ActionDispatchPort, ClockPort, LoggerPort, Result } from '@ticrafter/core';
import {
    CheckpointManager,
    EffectsEmitter,
    MemoryCheckpointStore,
    PreemptionHandler,
    ProgressReporter,
    RestoreValidator,
    SkillCatalog,
    type SkillCheckpointStore,
    type SkillContext,
    SkillContextBuilder,
    type SkillContextSource,
    type SkillInput,
    SkillLifecycleExecutor,
    type SkillProgressSink,
    type SkillStep,
    TickScheduler,
} from '@ticrafter/skills';

export interface SkillHostOptions {
    source: SkillContextSource;
    dispatch: ActionDispatchPort;
    progressSink: SkillProgressSink;
    logger: LoggerPort;
    tickMilliseconds: number;
    checkpointStore?: SkillCheckpointStore;
    clock?: ClockPort;
}

export class SkillHost {
    private readonly builder: SkillContextBuilder;
    private readonly lifecycle: SkillLifecycleExecutor;
    private readonly scheduler: TickScheduler;
    private readonly preemption: PreemptionHandler;
    private readonly checkpoints: CheckpointManager;
    private currentTaskId: string | null = null;

    private constructor(
        private readonly options: SkillHostOptions,
        lifecycle: SkillLifecycleExecutor,
        checkpoints: CheckpointManager,
    ) {
        this.builder = new SkillContextBuilder(options.source);
        this.lifecycle = lifecycle;
        this.scheduler =
            options.clock === undefined
                ? new TickScheduler(options.tickMilliseconds)
                : new TickScheduler(options.tickMilliseconds, options.clock);
        this.preemption = new PreemptionHandler(lifecycle);
        this.checkpoints = checkpoints;
    }

    static create(options: SkillHostOptions): Result<SkillHost, string> {
        const [registry, registryError] = SkillCatalog.createRegistry();
        if (registryError) return [null, registryError];
        if (registry === null) return [null, 'skill registry returned null'];
        const checkpoints = new CheckpointManager(
            options.checkpointStore ?? new MemoryCheckpointStore(),
        );
        const lifecycle = new SkillLifecycleExecutor({
            registry,
            dispatch: options.dispatch,
            effects: new EffectsEmitter(),
            reporter: new ProgressReporter(options.progressSink),
            checkpoints,
            restoreValidator: new RestoreValidator(),
        });
        return [new SkillHost(options, lifecycle, checkpoints), null];
    }

    start(): Result<void, string> {
        return this.scheduler.start(() => this.tick());
    }

    stop(): void {
        const [, cancelError] = this.cancel('skill host stopped');
        if (cancelError) this.options.logger.warn({ error: cancelError }, 'skill stop failed');
        this.scheduler.stop();
    }

    run(skillId: string, input: SkillInput): Result<SkillStep, string> {
        const taskId = input.taskId;
        const [context, contextError] = this.builder.build(null, taskId);
        if (contextError) return [null, contextError];
        if (context === null) return [null, 'skill context returned null'];
        const [step, startError] = this.lifecycle.start(skillId, input, context);
        if (startError) return [null, startError];
        this.currentTaskId = taskId ?? null;
        return [step, null];
    }

    resume(skillId: string, taskId = 'default'): Result<SkillStep, string> {
        const [context, contextError] = this.builder.build(null, taskId);
        if (contextError) return [null, contextError];
        if (context === null) return [null, 'skill context returned null'];
        const [checkpoint, loadError] = this.checkpoints.load(context.botId, taskId, skillId);
        if (loadError) return [null, loadError];
        if (checkpoint === null) return [null, `no checkpoint for ${skillId}`];
        const [step, resumeError] = this.lifecycle.resume(skillId, checkpoint, context);
        if (resumeError) return [null, resumeError];
        this.currentTaskId = taskId;
        return [step, null];
    }

    cancel(reason: string): Result<SkillStep | null, string> {
        const [context, contextError] = this.buildContext();
        if (contextError) return [null, contextError];
        if (context === null) return [null, 'skill context returned null'];
        return this.lifecycle.cancel(context, reason);
    }

    preempt(reason: string): Result<SkillStep | null, string> {
        const [context, contextError] = this.buildContext();
        if (contextError) {
            this.options.logger.warn({ error: contextError }, 'skill preemption failed');
            return [null, contextError];
        }
        if (context === null) return [null, 'skill context returned null'];
        const [step, preemptError] = this.preemption.preempt(context, reason);
        if (preemptError) {
            this.options.logger.warn({ error: preemptError }, 'skill preemption failed');
            return [null, preemptError];
        }
        return [step, null];
    }

    get activeSkillId(): string | null {
        return this.lifecycle.activeSkillId;
    }

    get activeTaskId(): string | null {
        return this.currentTaskId;
    }

    private buildContext(): Result<SkillContext, string> {
        return this.builder.build(null, this.currentTaskId ?? undefined);
    }

    private tick(): void {
        const [context, contextError] = this.buildContext();
        if (contextError) {
            this.options.logger.warn({ error: contextError }, 'skill context failed');
            return;
        }
        if (context === null) return;
        const [, advanceError] = this.lifecycle.advance(context);
        if (advanceError) this.options.logger.warn({ error: advanceError }, 'skill tick failed');
    }
}

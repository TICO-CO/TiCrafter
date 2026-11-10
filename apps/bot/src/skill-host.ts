import type { ActionDispatchPort, LoggerPort, Result } from '@ticrafter/core';
import {
    CheckpointManager,
    EffectsEmitter,
    MemoryCheckpointStore,
    PreemptionHandler,
    ProgressReporter,
    SkillCatalog,
    type SkillCheckpointStore,
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
}

export class SkillHost {
    private readonly builder: SkillContextBuilder;
    private readonly lifecycle: SkillLifecycleExecutor;
    private readonly scheduler: TickScheduler;
    private readonly preemption: PreemptionHandler;

    private constructor(
        private readonly options: SkillHostOptions,
        lifecycle: SkillLifecycleExecutor,
    ) {
        this.builder = new SkillContextBuilder(options.source);
        this.lifecycle = lifecycle;
        this.scheduler = new TickScheduler(options.tickMilliseconds);
        this.preemption = new PreemptionHandler(lifecycle);
    }

    static create(options: SkillHostOptions): Result<SkillHost, string> {
        const [registry, registryError] = SkillCatalog.createRegistry();
        if (registryError) return [null, registryError];
        if (registry === null) return [null, 'skill registry returned null'];
        const lifecycle = new SkillLifecycleExecutor({
            registry,
            dispatch: options.dispatch,
            effects: new EffectsEmitter(),
            reporter: new ProgressReporter(options.progressSink),
            checkpoints: new CheckpointManager(
                options.checkpointStore ?? new MemoryCheckpointStore(),
            ),
        });
        return [new SkillHost(options, lifecycle), null];
    }

    start(): Result<void, string> {
        return this.scheduler.start(() => this.tick());
    }

    stop(): void {
        this.scheduler.stop();
    }

    run(skillId: string, input: SkillInput): Result<SkillStep, string> {
        const [context, contextError] = this.builder.build(null);
        if (contextError) return [null, contextError];
        if (context === null) return [null, 'skill context returned null'];
        return this.lifecycle.start(skillId, input, context);
    }

    preempt(reason: string): void {
        const [context, contextError] = this.builder.build(null);
        if (contextError || context === null) {
            this.options.logger.warn({ error: contextError }, 'skill preemption failed');
            return;
        }
        const [, preemptError] = this.preemption.preempt(context, reason);
        if (preemptError)
            this.options.logger.warn({ error: preemptError }, 'skill preemption failed');
    }

    get activeSkillId(): string | null {
        return this.lifecycle.activeSkillId;
    }

    private tick(): void {
        const [context, contextError] = this.builder.build(null);
        if (contextError) {
            this.options.logger.warn({ error: contextError }, 'skill context failed');
            return;
        }
        if (context === null) return;
        const [, advanceError] = this.lifecycle.advance(context);
        if (advanceError) this.options.logger.warn({ error: advanceError }, 'skill tick failed');
    }
}

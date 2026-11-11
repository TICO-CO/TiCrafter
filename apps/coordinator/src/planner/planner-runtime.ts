import type { LoggerPort } from '@ticrafter/core';
import type { PlannerService, PlannerTrigger, PlannerTriggerEvaluator } from '@ticrafter/planning';

export interface PlannerRuntimeOptions {
    service: PlannerService;
    triggers: PlannerTriggerEvaluator;
    logger: LoggerPort;
    now?: () => number;
}

export class PlannerRuntime {
    private running = false;

    constructor(private readonly options: PlannerRuntimeOptions) {}

    tick(): void {
        const trigger = this.options.triggers.evaluateInterval(this.now());
        if (trigger === null) return;
        this.run(trigger);
    }

    noteConflict(reason: string): void {
        const trigger = this.options.triggers.observeConflict(reason, this.now());
        if (trigger === null) return;
        this.run(trigger);
    }

    noteTaskFailure(): void {
        const trigger = this.options.triggers.observeTaskFailure(this.now());
        if (trigger === null) return;
        this.run(trigger);
    }

    noteDeath(): void {
        const trigger = this.options.triggers.observeDeath(this.now());
        if (trigger === null) return;
        this.run(trigger);
    }

    noteLandmark(landmarkId: string): void {
        const trigger = this.options.triggers.observeLandmark(landmarkId, this.now());
        if (trigger === null) return;
        this.run(trigger);
    }

    noteChat(request: string): void {
        this.run(this.options.triggers.observeChat(request, this.now()));
    }

    private run(trigger: PlannerTrigger): void {
        if (this.running) {
            this.options.logger.warn({ trigger: trigger.kind }, 'planner cycle already running');
            return;
        }
        this.running = true;
        void this.options.service
            .plan(trigger)
            .then(
                ([cycle, cycleError]) => {
                    if (cycleError) {
                        this.options.logger.warn(
                            { error: cycleError.type, trigger: trigger.kind },
                            'planner cycle failed',
                        );
                        return;
                    }
                    if (cycle === null) return;
                    this.options.logger.info(
                        {
                            source: cycle.source,
                            planId: cycle.plan?.planId ?? null,
                            applicable: cycle.applicable,
                            attempts: cycle.attempts,
                            sipMutations: cycle.sipProposal?.mutations.length ?? 0,
                            tasks: cycle.taskProposals.length,
                            failure: cycle.failure?.type ?? null,
                        },
                        'planner cycle complete',
                    );
                },
                (error: unknown) => {
                    this.options.logger.error(
                        { error, trigger: trigger.kind },
                        'planner cycle crashed',
                    );
                },
            )
            .finally(() => {
                this.running = false;
            });
    }

    private now(): number {
        return this.options.now?.() ?? Date.now();
    }
}

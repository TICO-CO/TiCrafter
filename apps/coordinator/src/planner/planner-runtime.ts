import type { LoggerPort, Result } from '@ticrafter/core';
import type {
    PlannerCycleResult,
    PlannerFailure,
    PlannerTrigger,
    PlannerTriggerEvaluator,
} from '@ticrafter/planning';

import type { PlannerCycleApplierPort } from './cycle-applier.js';

export interface PlannerCycleSource {
    plan(
        trigger: PlannerTrigger,
        signal?: AbortSignal,
    ): Promise<Result<PlannerCycleResult, PlannerFailure>>;
}

export interface PlannerRuntimeOptions {
    service: PlannerCycleSource;
    triggers: PlannerTriggerEvaluator;
    applier: PlannerCycleApplierPort;
    logger: LoggerPort;
    beforeCycle?: () => Result<void, string>;
    now?: () => number;
}

export class PlannerRuntime {
    private running = false;

    constructor(private readonly options: PlannerRuntimeOptions) {}

    tick(openTasks = 0, onlineBots = 0): void {
        if (this.running) return;
        const now = this.now();
        const interval = this.options.triggers.evaluateInterval(now);
        if (interval !== null) {
            this.run(interval);
            return;
        }
        const workGap = this.options.triggers.observeWorkGap(openTasks, onlineBots, now);
        if (workGap !== null) this.run(workGap);
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
        if (this.options.beforeCycle) {
            const [, beforeError] = this.options.beforeCycle();
            if (beforeError) {
                this.options.logger.warn(
                    { error: beforeError, trigger: trigger.kind },
                    'planner pre-cycle audit failed',
                );
                return;
            }
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
                    this.apply(cycle, trigger);
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

    private apply(cycle: PlannerCycleResult, trigger: PlannerTrigger): void {
        const [report, applyError] = this.options.applier.apply(cycle);
        if (applyError) {
            this.options.logger.warn(
                { error: applyError, trigger: trigger.kind, planId: cycle.plan?.planId ?? null },
                'planner cycle apply failed',
            );
            return;
        }
        this.options.logger.info(
            {
                source: cycle.source,
                planId: cycle.plan?.planId ?? null,
                applicable: cycle.applicable,
                attempts: cycle.attempts,
                sipMutations: cycle.sipProposal?.mutations.length ?? 0,
                tasks: cycle.taskProposals.length,
                failure: cycle.failure,
                applied: report,
            },
            'planner cycle applied',
        );
    }

    private now(): number {
        return this.options.now?.() ?? Date.now();
    }
}

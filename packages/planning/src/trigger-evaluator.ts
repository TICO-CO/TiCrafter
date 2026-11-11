import type { PlannerTrigger } from './types.js';

export interface PlannerTriggerEvaluatorOptions {
    intervalMilliseconds: number;
    failureBurstThreshold?: number;
    failureBurstWindowMilliseconds?: number;
    deathClusterThreshold?: number;
    deathClusterWindowMilliseconds?: number;
    landmarkCooldownMilliseconds?: number;
    conflictCooldownMilliseconds?: number;
    createId?: () => string;
}

export class PlannerTriggerEvaluator {
    private lastIntervalAt: number | null = null;
    private lastConflictAt: number | null = null;
    private lastLandmarkAt: number | null = null;
    private lastFailureBurstAt: number | null = null;
    private lastDeathClusterAt: number | null = null;
    private readonly failures: number[] = [];
    private readonly deaths: number[] = [];

    constructor(private readonly options: PlannerTriggerEvaluatorOptions) {}

    evaluateInterval(now: number): PlannerTrigger | null {
        if (this.lastIntervalAt !== null) {
            const elapsed = now - this.lastIntervalAt;
            if (elapsed < this.options.intervalMilliseconds) return null;
        }
        this.lastIntervalAt = now;
        return this.trigger('interval', 'planner interval elapsed', now, {});
    }

    observeConflict(reason: string, now: number): PlannerTrigger | null {
        const cooldown = this.options.conflictCooldownMilliseconds ?? 60_000;
        if (this.lastConflictAt !== null && now - this.lastConflictAt < cooldown) return null;
        this.lastConflictAt = now;
        return this.trigger('sip_conflict', reason, now, {});
    }

    observeTaskFailure(now: number): PlannerTrigger | null {
        this.failures.push(now);
        const window = this.options.failureBurstWindowMilliseconds ?? 300_000;
        this.prune(this.failures, now, window);
        const threshold = this.options.failureBurstThreshold ?? 3;
        if (this.failures.length < threshold) return null;
        if (this.lastFailureBurstAt !== null && now - this.lastFailureBurstAt < window) {
            return null;
        }
        this.lastFailureBurstAt = now;
        const count = this.failures.length;
        this.failures.length = 0;
        return this.trigger('task_failure_burst', 'task failure burst detected', now, { count });
    }

    observeDeath(now: number): PlannerTrigger | null {
        this.deaths.push(now);
        const window = this.options.deathClusterWindowMilliseconds ?? 300_000;
        this.prune(this.deaths, now, window);
        const threshold = this.options.deathClusterThreshold ?? 2;
        if (this.deaths.length < threshold) return null;
        if (this.lastDeathClusterAt !== null && now - this.lastDeathClusterAt < window) {
            return null;
        }
        this.lastDeathClusterAt = now;
        const count = this.deaths.length;
        this.deaths.length = 0;
        return this.trigger('death_cluster', 'bot death cluster detected', now, { count });
    }

    observeLandmark(landmarkId: string, now: number): PlannerTrigger | null {
        const cooldown = this.options.landmarkCooldownMilliseconds ?? 120_000;
        if (this.lastLandmarkAt !== null && now - this.lastLandmarkAt < cooldown) return null;
        this.lastLandmarkAt = now;
        return this.trigger('landmark', 'new landmark observed', now, { landmarkId });
    }

    observeChat(request: string, now: number): PlannerTrigger {
        return this.trigger('chat_request', 'operator chat request', now, { request });
    }

    observeArbitration(requestId: string, now: number): PlannerTrigger {
        return this.trigger('arbitration', 'edit arbitration requested', now, { requestId });
    }

    private prune(values: number[], now: number, window: number): void {
        while (values.length > 0) {
            const oldest = values[0];
            if (oldest === undefined || now - oldest <= window) return;
            values.shift();
        }
    }

    private trigger(
        kind: PlannerTrigger['kind'],
        reason: string,
        now: number,
        detail: Readonly<Record<string, unknown>>,
    ): PlannerTrigger {
        return {
            kind,
            id: (this.options.createId ?? (() => crypto.randomUUID()))(),
            reason,
            requestedAt: new Date(now).toISOString(),
            detail,
        };
    }
}

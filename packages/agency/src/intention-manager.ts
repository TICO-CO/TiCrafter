import type { Result } from '@ticrafter/core';

import type { AbandonmentReason, Goal, Intention } from './types.js';

export interface IntentionOutcome {
    intention: Intention;
    status: 'completed' | 'abandoned';
    reason: AbandonmentReason | null;
    at: string;
}

export class IntentionManager {
    private current: Intention | null = null;

    get intention(): Intention | null {
        return this.current;
    }

    begin(goal: Goal, now: string): Result<Intention, string> {
        if (this.current !== null) return [null, 'an intention is already active'];
        if (goal.steps.length === 0) return [null, 'goal has no steps'];
        const intention: Intention = {
            goalId: goal.id,
            label: goal.label,
            stepIndex: 0,
            createdAt: now,
            deadline: goal.deadline,
            attempts: 0,
        };
        this.current = intention;
        return [intention, null];
    }

    advance(now: string): Result<Intention, string> {
        const intention = this.current;
        if (intention === null) return [null, 'no active intention'];
        const next: Intention = { ...intention, stepIndex: intention.stepIndex + 1 };
        this.current = next;
        return [next, null];
    }

    retry(): Result<Intention, string> {
        const intention = this.current;
        if (intention === null) return [null, 'no active intention'];
        const next: Intention = { ...intention, attempts: intention.attempts + 1 };
        this.current = next;
        return [next, null];
    }

    extendDeadline(deadline: string): Result<Intention, string> {
        const intention = this.current;
        if (intention === null) return [null, 'no active intention'];
        if (intention.deadlineExtended === true) {
            return [null, 'intention deadline was already extended'];
        }
        const next: Intention = { ...intention, deadline, deadlineExtended: true };
        this.current = next;
        return [next, null];
    }

    complete(now: string): Result<IntentionOutcome, string> {
        const intention = this.current;
        if (intention === null) return [null, 'no active intention'];
        this.current = null;
        return [{ intention, status: 'completed', reason: null, at: now }, null];
    }

    abandon(reason: AbandonmentReason, now: string): Result<IntentionOutcome, string> {
        const intention = this.current;
        if (intention === null) return [null, 'no active intention'];
        this.current = null;
        return [{ intention, status: 'abandoned', reason, at: now }, null];
    }

    expired(now: string): boolean {
        const intention = this.current;
        if (intention?.deadline === null || intention?.deadline === undefined) return false;
        return Date.parse(intention.deadline) <= Date.parse(now);
    }

    restore(intention: Intention): void {
        this.current = intention;
    }
}

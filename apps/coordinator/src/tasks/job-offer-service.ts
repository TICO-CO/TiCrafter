import type { Result } from '@ticrafter/core';

import type { TaskRole } from './types.js';

export interface JobOffer {
    taskId: string;
    title: string;
    priority: number;
    skillId: string | null;
    target: { x: number; y: number; z: number } | null;
    requiredRole: TaskRole | null;
    distance: number | null;
}

export type JobDecision = 'accept' | 'defer' | 'decline';

export interface JobOfferContext {
    botId: string;
    role: TaskRole | null;
    position: { x: number; y: number; z: number } | null;
    inventory: Readonly<Record<string, number>>;
}

export interface JobTaskAssignment {
    id: string;
    title: string;
    priority: number;
    payload: Readonly<Record<string, unknown>>;
    target: { x: number; y: number; z: number } | null;
    requiredRole: TaskRole | null;
}

export interface JobAssignment {
    offer: JobOffer;
    task: JobTaskAssignment;
    fencingToken: number;
    leaseUntil: string;
}

export interface JobOfferPort {
    offers(context: JobOfferContext): Result<readonly JobOffer[], string>;
    accept(context: JobOfferContext, taskId: string): Result<JobAssignment, string>;
    decide(
        context: JobOfferContext,
        taskId: string,
        decision: JobDecision,
        reason: string,
    ): Result<void, string>;
}

export class JobOfferService {
    constructor(private readonly port: JobOfferPort) {}

    offer(context: JobOfferContext): Result<readonly JobOffer[], string> {
        return this.port.offers(context);
    }

    resolve(
        context: JobOfferContext,
        taskId: string,
        decision: JobDecision,
        reason: string,
    ): Result<JobAssignment | null, string> {
        if (decision === 'accept') return this.port.accept(context, taskId);
        const [, error] = this.port.decide(context, taskId, decision, reason);
        if (error) return [null, error];
        return [null, null];
    }
}

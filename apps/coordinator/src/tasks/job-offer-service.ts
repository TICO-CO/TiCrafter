import type { Result } from '@ticrafter/core';

export interface JobOffer {
    taskId: string;
    title: string;
    priority: number;
    skillId: string | null;
    target: { x: number; y: number; z: number } | null;
    requiredRole: string | null;
}

export type JobDecision = 'accept' | 'defer' | 'decline';

export interface JobOfferPort {
    offers(botId: string): Result<readonly JobOffer[], string>;
    accept(botId: string, taskId: string): Result<JobOffer, string>;
    decide(
        botId: string,
        taskId: string,
        decision: JobDecision,
        reason: string,
    ): Result<void, string>;
}

export interface JobOfferResult {
    offers: readonly JobOffer[];
    accepted: JobOffer | null;
}

export class JobOfferService {
    constructor(private readonly port: JobOfferPort) {}

    offer(botId: string): Result<readonly JobOffer[], string> {
        return this.port.offers(botId);
    }

    resolve(
        botId: string,
        taskId: string,
        decision: JobDecision,
        reason: string,
    ): Result<JobOffer | null, string> {
        if (decision === 'accept') {
            return this.port.accept(botId, taskId);
        }
        const [, error] = this.port.decide(botId, taskId, decision, reason);
        if (error) return [null, error];
        return [null, null];
    }
}

import type { Result } from '@ticrafter/core';

export interface BotClaimRequest {
    botId: string;
    resourceType: string;
    resourceId: string;
    bbox: {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    };
}

export interface BotClaimCommandPort {
    acquire(request: BotClaimRequest): Result<{ claimId: string; fencingToken: number }, string>;
    renew(
        botId: string,
        claimId: string,
        fencingToken: number,
    ): Result<{ leaseUntil: string }, string>;
    release(botId: string, claimId: string, fencingToken: number): Result<void, string>;
}

export class BotClaimCommandHandler {
    constructor(private readonly port: BotClaimCommandPort) {}

    acquire(request: BotClaimRequest): Result<{ claimId: string; fencingToken: number }, string> {
        if (request.botId.length === 0) return [null, 'botId is required'];
        return this.port.acquire(request);
    }

    renew(
        botId: string,
        claimId: string,
        fencingToken: number,
    ): Result<{ leaseUntil: string }, string> {
        return this.port.renew(botId, claimId, fencingToken);
    }

    release(botId: string, claimId: string, fencingToken: number): Result<void, string> {
        return this.port.release(botId, claimId, fencingToken);
    }
}

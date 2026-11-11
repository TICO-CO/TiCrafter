import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

export type OpsFailure =
    | { type: 'LISTEN_FAILED'; message: string }
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'BOT_NOT_CONNECTED'; botId: string }
    | { type: 'COMMAND_FAILED'; message: string }
    | { type: 'INVALID_REQUEST'; message: string }
    | { type: 'UNAVAILABLE'; message: string };

export interface OpsAuditEvent {
    botId?: string;
    type: string;
    payload?: unknown;
    actor?: string;
    createdAt?: string;
}

export interface OpsAuditPort {
    append(event: OpsAuditEvent): Result<number, StorageFailure>;
}

export interface OpsControlResult {
    bots: readonly string[];
    failures: readonly OpsFailure[];
}

export interface OpsControlRequest {
    botId?: string;
    reason?: string;
}

export interface OpsDecisionStatus {
    enabled: boolean;
    provider: string;
    modelLoaded: boolean;
    failure: string | null;
    latency: {
        samples: number;
        p50: number;
        p95: number;
        fallbackRate: number;
    };
}

export interface OpsDecisionStatusPort {
    status(): OpsDecisionStatus;
}

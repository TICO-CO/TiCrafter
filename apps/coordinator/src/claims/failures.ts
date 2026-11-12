import type { StorageFailure } from '@ticrafter/memory';

import type { ClaimFailure, ClaimStatus } from './types.js';

export class ClaimFailures {
    static storage(failure: StorageFailure): ClaimFailure {
        return { type: 'STORAGE', failure };
    }

    static claimNotFound(claimId: string): ClaimFailure {
        return { type: 'CLAIM_NOT_FOUND', claimId };
    }

    static invalidClaim(message: string): ClaimFailure {
        return { type: 'INVALID_CLAIM', message };
    }

    static malformedClaim(message: string): ClaimFailure {
        return { type: 'MALFORMED_CLAIM', message };
    }

    static overlap(claimIds: readonly string[]): ClaimFailure {
        return { type: 'OVERLAP', claimIds };
    }

    static staleToken(claimId: string, expected: number, actual: number): ClaimFailure {
        return { type: 'STALE_TOKEN', claimId, expected, actual };
    }

    static ownerMismatch(claimId: string, botId: string): ClaimFailure {
        return { type: 'OWNER_MISMATCH', claimId, botId };
    }

    static invalidStatus(claimId: string, status: ClaimStatus): ClaimFailure {
        return { type: 'INVALID_STATUS', claimId, status };
    }

    static sessionInvalid(botId: string): ClaimFailure {
        return { type: 'SESSION_INVALID', botId };
    }

    static taskRequeueFailed(taskId: string, message: string): ClaimFailure {
        return { type: 'TASK_REQUEUE_FAILED', taskId, message };
    }
}

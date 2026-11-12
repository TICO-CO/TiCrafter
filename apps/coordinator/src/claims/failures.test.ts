import { describe, expect, it } from 'bun:test';

import { ClaimFailures } from './failures.js';

describe('ClaimFailures', () => {
    it('constructs each claim failure variant', () => {
        const storage = { type: 'READ_FAILED' as const, message: 'read failed' };
        expect(ClaimFailures.storage(storage)).toEqual({ type: 'STORAGE', failure: storage });
        expect(ClaimFailures.claimNotFound('claim-1')).toEqual({
            type: 'CLAIM_NOT_FOUND',
            claimId: 'claim-1',
        });
        expect(ClaimFailures.invalidClaim('bad')).toEqual({
            type: 'INVALID_CLAIM',
            message: 'bad',
        });
        expect(ClaimFailures.malformedClaim('bad')).toEqual({
            type: 'MALFORMED_CLAIM',
            message: 'bad',
        });
        expect(ClaimFailures.overlap(['one'])).toEqual({ type: 'OVERLAP', claimIds: ['one'] });
        expect(ClaimFailures.staleToken('claim-1', 2, 1)).toEqual({
            type: 'STALE_TOKEN',
            claimId: 'claim-1',
            expected: 2,
            actual: 1,
        });
        expect(ClaimFailures.ownerMismatch('claim-1', 'bot.one')).toEqual({
            type: 'OWNER_MISMATCH',
            claimId: 'claim-1',
            botId: 'bot.one',
        });
        expect(ClaimFailures.invalidStatus('claim-1', 'active')).toEqual({
            type: 'INVALID_STATUS',
            claimId: 'claim-1',
            status: 'active',
        });
        expect(ClaimFailures.sessionInvalid('bot.one')).toEqual({
            type: 'SESSION_INVALID',
            botId: 'bot.one',
        });
        expect(ClaimFailures.taskRequeueFailed('task-1', 'failed')).toEqual({
            type: 'TASK_REQUEUE_FAILED',
            taskId: 'task-1',
            message: 'failed',
        });
    });
});

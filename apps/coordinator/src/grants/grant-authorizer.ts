import type { Result } from '@ticrafter/core';

import { SipGeometry, type SipStructure } from '../sip/index.js';
import type { EditGrantRepository } from './grant-repository.js';
import type {
    EditGrantRecord,
    GrantAuthorizationInput,
    GrantFailure,
    GrantSipPort,
} from './types.js';

export class GrantAuthorizer {
    constructor(
        private readonly repository: EditGrantRepository,
        private readonly sip: GrantSipPort,
        private readonly validateRevision: (
            grant: EditGrantRecord,
            structure: SipStructure | null,
        ) => Result<void, GrantFailure>,
    ) {}

    authorize(
        input: GrantAuthorizationInput,
        now = new Date().toISOString(),
    ): Result<EditGrantRecord, GrantFailure> {
        const [grant, readError] = this.repository.get(input.grantId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (grant === null) return [null, { type: 'GRANT_NOT_FOUND', grantId: input.grantId }];
        const [, statusError] = this.validateStatus(grant, input, now);
        if (statusError) return [null, statusError];
        const [snapshot, snapshotError] = this.sip.load();
        if (snapshotError) return [null, { type: 'STORAGE', failure: snapshotError }];
        if (snapshot === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'sip snapshot missing' }];
        }
        const structure =
            snapshot.structures.find((candidate) => candidate.id === grant.structureId) ?? null;
        const [, revisionError] = this.validateRevision(grant, structure);
        if (revisionError) return [null, revisionError];
        const [, scopeError] = this.validateScope(grant, input);
        if (scopeError) return [null, scopeError];
        return [grant, null];
    }

    private validateStatus(
        grant: EditGrantRecord,
        input: GrantAuthorizationInput,
        now: string,
    ): Result<void, GrantFailure> {
        if (grant.status !== 'active') {
            return [null, { type: 'INVALID_STATUS', grantId: grant.id, status: grant.status }];
        }
        if (grant.expiresAt <= now) {
            return [null, { type: 'GRANT_EXPIRED', grantId: grant.id, expiresAt: grant.expiresAt }];
        }
        if (grant.granteeBotId !== input.botId) {
            return [null, { type: 'GRANTEE_MISMATCH', grantId: grant.id, botId: input.botId }];
        }
        if (grant.fencingToken !== input.fencingToken) {
            return [
                null,
                {
                    type: 'STALE_TOKEN',
                    grantId: grant.id,
                    expected: grant.fencingToken,
                    actual: input.fencingToken,
                },
            ];
        }
        return [undefined, null];
    }

    private validateScope(
        grant: EditGrantRecord,
        input: GrantAuthorizationInput,
    ): Result<void, GrantFailure> {
        const denied = input.operations.filter(
            (operation) => !grant.allowedOps.includes(operation),
        );
        if (denied.length > 0) return [null, { type: 'OPERATION_NOT_GRANTED', operations: denied }];
        if (!SipGeometry.contains(grant.bbox, input.bbox)) {
            return [null, { type: 'OUT_OF_SCOPE', message: 'requested bbox exceeds grant scope' }];
        }
        return [undefined, null];
    }
}

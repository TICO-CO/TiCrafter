import type { Result } from '@ticrafter/core';

import type { SipSnapshotRepository } from './snapshot-repository.js';
import type { SipCommit, SipFailure, SipSnapshot } from './types.js';

export class SipRevisionManager {
    constructor(private readonly repository: SipSnapshotRepository) {}

    allocate(snapshot: SipSnapshot, expectedRevision: number): Result<number, SipFailure> {
        if (snapshot.revision !== expectedRevision) {
            return [
                null,
                { type: 'STALE_REVISION', expected: expectedRevision, actual: snapshot.revision },
            ];
        }
        return [snapshot.revision + 1, null];
    }

    findExisting(idempotencyKey: string): Result<SipCommit | null, SipFailure> {
        const [commit, readError] = this.repository.findByIdempotencyKey(idempotencyKey);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        return [commit, null];
    }
}

import type { Result } from '@ticrafter/core';

import type { SipStructure } from '../sip/index.js';
import type { EditGrantRepository } from './grant-repository.js';
import type {
    EditGrantAuthority,
    EditGrantRecord,
    EditRequestInput,
    GrantFailure,
} from './types.js';

export interface GrantIssuerOptions {
    epoch: number;
    defaultTtlMilliseconds?: number;
}

export class GrantIssuer {
    constructor(
        private readonly repository: EditGrantRepository,
        private readonly options: GrantIssuerOptions,
    ) {}

    issue(
        input: EditRequestInput,
        structure: SipStructure,
        grantedBy: EditGrantAuthority,
        now: string,
    ): Result<EditGrantRecord, GrantFailure> {
        const [existing, existingError] = this.repository.get(input.id);
        if (existingError) return [null, { type: 'STORAGE', failure: existingError }];
        if (existing !== null) return [null, { type: 'DUPLICATE_GRANT', grantId: input.id }];
        const ttl = input.ttlMilliseconds ?? this.options.defaultTtlMilliseconds ?? 60_000;
        const nowMilliseconds = Date.parse(now);
        if (!Number.isFinite(nowMilliseconds) || ttl <= 0) {
            return [null, { type: 'INVALID_REQUEST', message: 'invalid grant expiry' }];
        }
        const [fencingToken, tokenError] = this.repository.nextFencingToken();
        if (tokenError) return [null, { type: 'STORAGE', failure: tokenError }];
        if (fencingToken === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'fencing token missing' }];
        }
        const record: EditGrantRecord = {
            id: input.id,
            structureId: structure.id,
            ownerBotId: structure.ownerBotIds[0] ?? '',
            granteeBotId: input.requesterBotId,
            designRevision: structure.designRevision,
            bbox: input.bbox,
            allowedOps: [...input.proposedOps],
            materialConstraints: [...(input.materialConstraints ?? [])],
            intent: input.intent,
            status: 'active',
            expiresAt: new Date(nowMilliseconds + ttl).toISOString(),
            fencingToken,
            epoch: this.options.epoch,
            grantedBy,
            taskId: input.taskId ?? null,
            createdAt: now,
            updatedAt: now,
        };
        const [, insertError] = this.repository.insert(record);
        if (insertError) return [null, { type: 'STORAGE', failure: insertError }];
        return [record, null];
    }
}

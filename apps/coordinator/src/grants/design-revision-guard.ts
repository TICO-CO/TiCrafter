import type { Result } from '@ticrafter/core';

import type { SipSnapshot, SipStructure } from '../sip/index.js';
import type { EditGrantRecord, GrantFailure } from './types.js';

export class DesignRevisionGuard {
    validate(grant: EditGrantRecord, structure: SipStructure | null): Result<void, GrantFailure> {
        if (structure === null) {
            return [
                null,
                {
                    type: 'STRUCTURE_NOT_FOUND',
                    structureId: grant.structureId,
                },
            ];
        }
        if (grant.designRevision !== structure.designRevision) {
            return [
                null,
                {
                    type: 'REVISION_MISMATCH',
                    expected: structure.designRevision,
                    actual: grant.designRevision,
                },
            ];
        }
        return [undefined, null];
    }

    staleGrants(grant: EditGrantRecord, snapshot: SipSnapshot): boolean {
        const structure =
            snapshot.structures.find((candidate) => candidate.id === grant.structureId) ?? null;
        return structure === null || structure.designRevision !== grant.designRevision;
    }
}

import type { Result } from '@ticrafter/core';

import { sipProposalSchema } from './schema.js';
import type { SipProposal, SipProposalInput, SipValidationFailure } from './types.js';

export class SipMutationProposer {
    propose(input: SipProposalInput): Result<SipProposal, SipValidationFailure> {
        const result = sipProposalSchema.safeParse(input);
        if (!result.success) {
            return [null, { type: 'INVALID_PROPOSAL', message: result.error.message }];
        }
        return [result.data, null];
    }
}

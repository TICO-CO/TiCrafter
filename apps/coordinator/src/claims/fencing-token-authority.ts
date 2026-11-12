import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
import { ClaimFailures } from './failures.js';
import type { ClaimFailure } from './types.js';

export class FencingTokenAuthority {
    constructor(
        private readonly repository: ClaimRepository,
        private readonly coordinatorEpoch: number,
    ) {}

    get epoch(): number {
        return this.coordinatorEpoch;
    }

    next(): Result<number, ClaimFailure> {
        const [token, tokenError] = this.repository.nextFencingToken();
        if (tokenError) return [null, ClaimFailures.storage(tokenError)];
        return [token, null];
    }
}

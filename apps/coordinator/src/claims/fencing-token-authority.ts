import type { Result } from '@ticrafter/core';

import type { ClaimRepository } from './claim-repository.js';
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
        if (tokenError) return [null, { type: 'STORAGE', failure: tokenError }];
        return [token, null];
    }
}

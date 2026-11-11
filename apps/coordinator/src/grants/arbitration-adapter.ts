import type { Result } from '@ticrafter/core';

import type { CompatibilityInput, GrantFailure } from './types.js';

export interface GrantArbitrationPort {
    request(input: CompatibilityInput): Result<boolean, string>;
}

export class GrantArbitrationAdapter {
    constructor(private readonly port: GrantArbitrationPort | null = null) {}

    escalate(input: CompatibilityInput): Result<boolean, GrantFailure> {
        if (this.port === null) {
            return [
                null,
                { type: 'ARBITRATION_UNAVAILABLE', message: 'planner arbitration is unavailable' },
            ];
        }
        const [decision, requestError] = this.port.request(input);
        if (requestError) {
            return [null, { type: 'ARBITRATION_UNAVAILABLE', message: requestError }];
        }
        return [decision ?? false, null];
    }
}

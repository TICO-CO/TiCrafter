import type { DecisionRequest } from '@ticrafter/core';

import type { DecisionFailure, DecisionOutcome } from './types.js';

export class DecisionTimeoutFallback {
    static outcome(
        request: DecisionRequest,
        failure: DecisionFailure,
        latencyMilliseconds: number,
        reason: string,
    ): DecisionOutcome {
        return {
            response: {
                botId: request.botId,
                at: new Date().toISOString(),
                choiceId: null,
                probabilities: {},
                answerConfidence: 0,
                danger: false,
                shouldContinue: true,
                latencyMilliseconds,
                source: 'fallback',
                reason: `${failure.type}: ${reason}`,
            },
            fallback: { source: 'fallback', reason },
        };
    }
}

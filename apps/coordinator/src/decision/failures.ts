import type { DecisionFailure } from './types.js';

export class DecisionFailures {
    static message(failure: DecisionFailure): string {
        switch (failure.type) {
            case 'DISABLED':
            case 'MODEL_UNAVAILABLE':
            case 'INFERENCE_FAILED':
            case 'INVALID_OUTPUT':
                return failure.message;
            case 'RATE_LIMITED':
                return `decision rate exceeded for ${failure.botId}`;
            case 'QUEUE_FULL':
                return `decision queue is full at ${failure.depth}`;
            case 'TIMEOUT':
                return `decision timed out after ${failure.timeoutMilliseconds}ms`;
            case 'BUSY':
                return 'a decision forward pass is already in flight';
            case 'CLOSED':
                return 'decision service is closed';
            default:
                return 'unknown decision failure';
        }
    }
}

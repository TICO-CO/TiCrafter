import { DECISION_TRACE, type DecisionRequest, type LoggerPort } from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { DecisionFailure, DecisionOutcome } from './types.js';

export class DecisionTraceRecorder {
    constructor(
        private readonly events: EventLogWriter,
        private readonly enabled: boolean,
        private readonly logger: LoggerPort,
    ) {}

    record(request: DecisionRequest, outcome: DecisionOutcome): void {
        if (!this.enabled) return;
        const [id, writeError] = this.events.append({
            botId: request.botId,
            type: DECISION_TRACE,
            payload: {
                request,
                response: outcome.response,
                parsed: outcome.parsed ?? null,
                fallback: outcome.fallback,
            },
        });
        if (writeError || id === null) {
            this.logger.warn({ error: writeError?.type ?? 'missing id' }, 'decision trace failed');
        }
    }

    recordFailure(request: DecisionRequest, failure: DecisionFailure): void {
        if (!this.enabled) return;
        const [id, writeError] = this.events.append({
            botId: request.botId,
            type: DECISION_TRACE,
            payload: {
                request,
                failure,
            },
        });
        if (writeError || id === null) {
            this.logger.warn(
                { error: writeError?.type ?? 'missing id' },
                'decision failure trace failed',
            );
        }
    }
}

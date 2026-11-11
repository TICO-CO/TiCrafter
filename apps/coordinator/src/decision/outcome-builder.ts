import type { DecisionRequest, Result } from '@ticrafter/core';

import type { DecisionConfidenceCalibrator } from './confidence-calibrator.js';
import { DecisionFailures } from './failures.js';
import type { DecisionLatencyMetrics } from './latency-metrics.js';
import { DecisionTimeoutFallback } from './timeout-fallback.js';
import type {
    DecisionFailure,
    DecisionJob,
    DecisionOutcome,
    DecisionParsedAnswer,
    DecisionProvider,
} from './types.js';

export class DecisionOutcomeBuilder {
    constructor(
        private readonly calibrator: DecisionConfidenceCalibrator,
        private readonly metrics: DecisionLatencyMetrics,
        private readonly now: () => number,
    ) {}

    success(
        job: DecisionJob,
        parsed: DecisionParsedAnswer,
        provider: DecisionProvider,
        started: number,
    ): Result<DecisionOutcome, DecisionFailure> {
        const calibrated = this.calibrator.calibrate(parsed);
        const latency = this.now() - started;
        const fallback = calibrated.belowGate;
        this.metrics.record({
            latencyMilliseconds: latency,
            queueWaitMilliseconds: started - job.createdAt,
            provider,
            fallback,
        });
        return [
            {
                response: {
                    botId: job.request.botId,
                    at: new Date(this.now()).toISOString(),
                    choiceId: fallback ? null : calibrated.choiceId,
                    probabilities: calibrated.probabilities,
                    answerConfidence: calibrated.calibratedConfidence,
                    danger: calibrated.danger,
                    shouldContinue: calibrated.shouldContinue,
                    latencyMilliseconds: latency,
                    source: fallback ? 'fallback' : 'laya',
                    ...(fallback ? { reason: 'confidence below gate' } : {}),
                },
                fallback: fallback ? { source: 'fallback', reason: 'confidence below gate' } : null,
                parsed,
            },
            null,
        ];
    }

    fallback(
        request: DecisionRequest,
        failure: DecisionFailure,
        provider: DecisionProvider,
        latencyMilliseconds = 0,
        queueWaitMilliseconds = latencyMilliseconds,
    ): Result<DecisionOutcome, DecisionFailure> {
        const reason = DecisionFailures.message(failure);
        this.metrics.record({
            latencyMilliseconds,
            queueWaitMilliseconds,
            provider,
            fallback: true,
        });
        return [
            DecisionTimeoutFallback.outcome(request, failure, latencyMilliseconds, reason),
            null,
        ];
    }

    disabled(
        request: DecisionRequest,
        provider: DecisionProvider,
    ): Result<DecisionOutcome, DecisionFailure> {
        return this.fallback(request, { type: 'DISABLED', message: 'decision disabled' }, provider);
    }
}

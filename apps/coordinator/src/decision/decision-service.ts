import {
    attemptAsync,
    type DecisionRequest,
    type LoggerPort,
    type Result,
    type TicrafterConfig,
} from '@ticrafter/core';

import { DecisionConfidenceCalibrator } from './confidence-calibrator.js';
import { DecisionWorker } from './decision-worker.js';
import { DecisionDigestAssembler } from './digest-assembler.js';
import { DecisionDigestCache } from './digest-cache.js';
import { DecisionLatencyMetrics } from './latency-metrics.js';
import { DecisionModelManager } from './model-manager.js';
import { DecisionOutcomeBuilder } from './outcome-builder.js';
import { DecisionOutputParser } from './output-parser.js';
import { DecisionQueue } from './queue.js';
import { DecisionRateLimiter } from './rate-limiter.js';
import { DecisionSingleInflightGuard } from './single-inflight-guard.js';
import type {
    DecisionFailure,
    DecisionJob,
    DecisionModelLoaderPort,
    DecisionOutcome,
} from './types.js';

export interface DecisionServiceOptions {
    config: TicrafterConfig;
    logger: LoggerPort;
    loader: DecisionModelLoaderPort;
    now?: () => number;
}

export interface DecisionServiceStatus {
    enabled: boolean;
    provider: string;
    modelLoaded: boolean;
    failure: string | null;
    latency: {
        samples: number;
        p50: number;
        p95: number;
        fallbackRate: number;
    };
}

export class DecisionService {
    private readonly queue: DecisionQueue;
    private readonly rateLimiter: DecisionRateLimiter;
    private readonly metrics: DecisionLatencyMetrics;
    private readonly models: DecisionModelManager;
    private readonly outcomes: DecisionOutcomeBuilder;
    private readonly worker: DecisionWorker;
    private readonly now: () => number;
    private closed = false;
    private draining = false;

    constructor(private readonly options: DecisionServiceOptions) {
        const decision = options.config.decision;
        this.queue = new DecisionQueue(decision.maxQueueDepth);
        this.rateLimiter = new DecisionRateLimiter(
            decision.fleetRatePerSecond,
            decision.botRatePerSecond,
        );
        this.now = options.now ?? Date.now;
        this.metrics = new DecisionLatencyMetrics();
        const calibrator = new DecisionConfidenceCalibrator(
            decision.providerTemperatures,
            decision.minConfidence,
        );
        this.outcomes = new DecisionOutcomeBuilder(calibrator, this.metrics, this.now);
        this.models = new DecisionModelManager(options.config, options.logger, options.loader);
        this.worker = new DecisionWorker({
            assembler: new DecisionDigestAssembler(decision.maxInputTokens),
            cache: new DecisionDigestCache(),
            parser: new DecisionOutputParser(),
            guard: new DecisionSingleInflightGuard(),
            outcomes: this.outcomes,
            models: this.models,
            timeoutMilliseconds: decision.timeoutMilliseconds,
            now: this.now,
        });
    }

    decide(
        botId: string,
        request: DecisionRequest,
    ): Promise<Result<DecisionOutcome, DecisionFailure>> {
        if (this.closed) return Promise.resolve([null, { type: 'CLOSED' }]);
        if (!this.options.config.decision.enabled) {
            return Promise.resolve(this.outcomes.disabled(request, this.models.provider));
        }
        const [, rateError] = this.rateLimiter.allow(botId, this.now());
        if (rateError) {
            return Promise.resolve(
                this.outcomes.fallback(request, rateError, this.models.provider),
            );
        }
        return new Promise((resolve) => {
            const job: DecisionJob = {
                id: crypto.randomUUID(),
                botId,
                request,
                priority: DecisionService.priority(request),
                createdAt: this.now(),
                resolve,
            };
            const [, queueError] = this.queue.enqueue(job);
            if (queueError) {
                resolve(this.outcomes.fallback(request, queueError, this.models.provider));
                return;
            }
            void this.drain();
        });
    }

    async close(): Promise<void> {
        this.closed = true;
        let job = this.queue.take();
        while (job !== null) {
            job.resolve([null, { type: 'CLOSED' }]);
            job = this.queue.take();
        }
        await this.models.close();
    }

    get latency(): DecisionLatencyMetrics {
        return this.metrics;
    }

    setRateScale(scale: number): void {
        this.rateLimiter.setRateScale(scale);
    }

    status(): DecisionServiceStatus {
        const latency = this.metrics.snapshot();
        return {
            enabled: this.options.config.decision.enabled,
            provider: this.models.provider,
            modelLoaded: this.models.loadedModel !== null,
            failure: this.models.loadFailure,
            latency: {
                samples: latency.samples,
                p50: latency.p50,
                p95: latency.p95,
                fallbackRate: latency.fallbackRate,
            },
        };
    }

    private async drain(): Promise<void> {
        if (this.draining) return;
        this.draining = true;
        let job = this.queue.take();
        while (job !== null) {
            const currentJob = job;
            const [outcome] = await attemptAsync(() => this.worker.process(currentJob));
            currentJob.resolve(
                outcome ??
                    this.outcomes.fallback(
                        currentJob.request,
                        { type: 'BUSY' },
                        this.models.provider,
                    ),
            );
            job = this.queue.take();
        }
        this.draining = false;
    }

    private static priority(request: DecisionRequest): number {
        const hazards = request.digest.hazards?.length ?? 0;
        return 100 - request.digest.health + hazards * 10;
    }
}

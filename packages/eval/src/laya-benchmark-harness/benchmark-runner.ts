import type { Result } from '@ticrafter/core';

import { BenchmarkFixture } from './benchmark-fixture.js';
import { BenchmarkSampler } from './benchmark-sampler.js';
import { LatencySummary } from './latency-summary.js';
import type {
    BenchmarkFailure,
    BenchmarkFailureKind,
    BenchmarkProvider,
    BenchmarkReport,
    BenchmarkRunnerOptions,
    LayaBenchmarkFixture,
    LayaModelLoaderPort,
    LayaModelPort,
    MemoryProbePort,
    MemorySnapshot,
} from './types.js';

export class LayaBenchmarkRunner {
    constructor(
        private readonly loader: LayaModelLoaderPort,
        private readonly memoryProbe: MemoryProbePort,
    ) {}

    async run(options: BenchmarkRunnerOptions): Promise<Result<BenchmarkReport, BenchmarkFailure>> {
        const validationFailure = this.validate(options);
        if (validationFailure) return [null, validationFailure];

        const fixtures: readonly [LayaBenchmarkFixture, ...LayaBenchmarkFixture[]] =
            options.fixtureVariant === 'mixed'
                ? [BenchmarkFixture.create('standard'), BenchmarkFixture.create('compact')]
                : [BenchmarkFixture.create(options.fixtureVariant)];
        const before = this.memoryProbe.snapshot();
        const [model, loadError] = await this.loader.load({
            provider: options.provider,
            threads: options.threads,
            revision: options.revision,
            cacheDir: options.cacheDir,
            modelDir: options.modelDir,
            ...(options.webgpu ? { webgpu: options.webgpu } : {}),
            ...(options.logSeverityLevel !== undefined
                ? { logSeverityLevel: options.logSeverityLevel }
                : {}),
            ...(options.fallbackToCpu !== undefined
                ? { fallbackToCpu: options.fallbackToCpu }
                : {}),
            ...(options.onDownloadProgress
                ? { onDownloadProgress: options.onDownloadProgress }
                : {}),
        });
        if (loadError)
            return [null, this.failure('MODEL_LOAD_FAILED', options.provider, loadError)];
        if (model === null) {
            return [null, this.failure('MODEL_LOAD_FAILED', options.provider, 'model is null')];
        }

        const afterLoad = this.memoryProbe.snapshot();
        const sampler = new BenchmarkSampler(
            model,
            this.memoryProbe,
            model.loadedProvider,
            fixtures,
        );
        const warmupFailure = await sampler.warmUp(options.warmupRequests);
        if (warmupFailure) {
            return [null, await this.closeWithFailure(model, options.provider, warmupFailure)];
        }

        const [measurement, measurementError] = await sampler.measure(options.measuredRequests);
        if (measurementError) {
            return [null, await this.closeWithFailure(model, options.provider, measurementError)];
        }
        if (measurement === null) {
            return [
                null,
                await this.closeWithFailure(
                    model,
                    options.provider,
                    this.failure('INFERENCE_FAILED', options.provider, 'measurement is null'),
                ),
            ];
        }

        const [soakMeasurement, soakError] = await sampler.soak(
            options.soakDurationMilliseconds,
            options.soakIntervalMilliseconds,
        );
        if (soakError) {
            return [null, await this.closeWithFailure(model, options.provider, soakError)];
        }

        const after = this.memoryProbe.snapshot();
        const closeFailure = await this.closeModel(model, options.provider);
        if (closeFailure) return [null, closeFailure];

        return [
            this.report(options, model, before, afterLoad, after, measurement, soakMeasurement),
            null,
        ];
    }

    private validate(options: BenchmarkRunnerOptions): BenchmarkFailure | null {
        if (options.measuredRequests < 1) {
            return this.failure(
                'INVALID_OPTIONS',
                options.provider,
                'measured requests must be > 0',
            );
        }
        if (options.warmupRequests < 0) {
            return this.failure(
                'INVALID_OPTIONS',
                options.provider,
                'warmup requests cannot be < 0',
            );
        }
        if (options.threads < 1) {
            return this.failure('INVALID_OPTIONS', options.provider, 'threads must be > 0');
        }
        if (options.soakDurationMilliseconds > 0 && options.soakIntervalMilliseconds < 1) {
            return this.failure('INVALID_OPTIONS', options.provider, 'soak interval must be > 0');
        }
        return null;
    }

    private report(
        options: BenchmarkRunnerOptions,
        model: LayaModelPort,
        before: MemorySnapshot,
        afterLoad: MemorySnapshot,
        after: MemorySnapshot,
        measurement: {
            latencies: number[];
            peakMemory: MemorySnapshot;
            inputTokens: number | null;
        },
        soakMeasurement: { report: BenchmarkReport['soak']; peakMemory: MemorySnapshot } | null,
    ): BenchmarkReport {
        const snapshots = [before, afterLoad, after, measurement.peakMemory];
        if (soakMeasurement) snapshots.push(soakMeasurement.peakMemory);
        const peak = LayaBenchmarkRunner.peak(snapshots);
        return {
            generatedAt: new Date().toISOString(),
            profile: options.profile,
            provider: model.loadedProvider,
            requestedProvider: options.provider,
            fallbackReason: model.fallbackReason,
            fixtureVariant: options.fixtureVariant,
            threads: options.threads,
            revision: options.revision,
            modelDir: model.modelDir,
            warmupRequests: options.warmupRequests,
            measuredRequests: options.measuredRequests,
            inputTokens: measurement.inputTokens,
            latency: LatencySummary.summarize(measurement.latencies),
            memory: {
                rssBeforeBytes: before.rssBytes,
                rssAfterLoadBytes: afterLoad.rssBytes,
                rssAfterBytes: after.rssBytes,
                rssPeakBytes: peak.rssBytes,
                vramBeforeBytes: before.vramUsedBytes,
                vramAfterLoadBytes: afterLoad.vramUsedBytes,
                vramAfterBytes: after.vramUsedBytes,
                vramPeakBytes: peak.vramUsedBytes,
                vramTotalBytes: peak.vramTotalBytes,
            },
            soak: soakMeasurement?.report ?? null,
        };
    }

    private async closeModel(
        model: LayaModelPort,
        provider: BenchmarkProvider,
    ): Promise<BenchmarkFailure | null> {
        const [, closeError] = await model.close();
        if (closeError) return this.failure('MODEL_CLOSE_FAILED', provider, closeError);
        return null;
    }

    private async closeWithFailure(
        model: LayaModelPort,
        provider: BenchmarkProvider,
        previousFailure: BenchmarkFailure,
    ): Promise<BenchmarkFailure> {
        const closeFailure = await this.closeModel(model, provider);
        if (closeFailure === null) return previousFailure;
        return {
            ...previousFailure,
            message: `${previousFailure.message}; close failed: ${closeFailure.message}`,
        };
    }

    private failure(
        kind: BenchmarkFailureKind,
        provider: BenchmarkProvider,
        message: string,
    ): BenchmarkFailure {
        return { kind, provider, message };
    }

    private static peak(snapshots: readonly MemorySnapshot[]): MemorySnapshot {
        return {
            rssBytes: Math.max(...snapshots.map((snapshot) => snapshot.rssBytes)),
            vramUsedBytes: LayaBenchmarkRunner.maximum(
                snapshots.map((snapshot) => snapshot.vramUsedBytes),
            ),
            vramTotalBytes: LayaBenchmarkRunner.maximum(
                snapshots.map((snapshot) => snapshot.vramTotalBytes),
            ),
        };
    }

    private static maximum(values: readonly (number | null)[]): number | null {
        const numbers = values.filter((value): value is number => value !== null);
        if (numbers.length === 0) return null;
        return Math.max(...numbers);
    }
}

import type { ChoiceQuestion, NoulQuestion, Question, SystemOneResult } from '@receptron/laya';
import type { HardwareProfile, Result } from '@ticrafter/core';

export type BenchmarkProvider = 'cpu' | 'webgpu';

export type BenchmarkFixtureKind = 'standard' | 'compact';

export type BenchmarkFixtureVariant = BenchmarkFixtureKind | 'mixed';

export interface BenchmarkQuestions extends Record<string, Question> {
    nextAction: ChoiceQuestion;
    danger: NoulQuestion;
    shouldContinue: NoulQuestion;
}

export type BenchmarkAnswer = SystemOneResult<BenchmarkQuestions>;

export interface LayaBenchmarkFixture {
    state: Record<string, unknown>;
    questions: BenchmarkQuestions;
    affordanceIds: string[];
}

export interface DownloadProgress {
    file: string;
    received: number;
    total: number | null;
}

export interface BenchmarkWebGpuOptions {
    validationMode?: 'disabled' | 'wgpuOnly' | 'basic' | 'full';
    preferredLayout?: 'NCHW' | 'NHWC';
}

export interface LayaModelLoadOptions {
    provider: BenchmarkProvider;
    threads: number;
    revision: string;
    cacheDir: string;
    modelDir: string | null;
    webgpu?: BenchmarkWebGpuOptions;
    logSeverityLevel?: 0 | 1 | 2 | 3 | 4;
    fallbackToCpu?: boolean;
    onDownloadProgress?: (progress: DownloadProgress) => void;
}

export interface LayaModelPort {
    readonly modelDir: string;
    readonly loadedProvider: BenchmarkProvider;
    readonly fallbackReason: string | null;
    answer(state: unknown, questions: BenchmarkQuestions): Promise<Result<BenchmarkAnswer, string>>;
    close(): Promise<Result<void, string>>;
}

export interface LayaModelLoaderPort {
    load(options: LayaModelLoadOptions): Promise<Result<LayaModelPort, string>>;
}

export interface LayaModelFactoryPort {
    load(
        options: LayaModelLoadOptions,
        fallbackReason?: string | null,
    ): Promise<Result<LayaModelPort, string>>;
}

export interface MemorySnapshot {
    rssBytes: number;
    vramUsedBytes: number | null;
    vramTotalBytes: number | null;
}

export interface MemoryProbePort {
    snapshot(): MemorySnapshot;
}

export interface LatencyStatistics {
    p50: number;
    p95: number;
    mean: number;
    min: number;
    max: number;
}

export interface BenchmarkSoakReport {
    durationMilliseconds: number;
    intervalMilliseconds: number;
    samples: number;
    completed: boolean;
    latency: LatencyStatistics | null;
}

export interface BenchmarkMemoryReport {
    rssBeforeBytes: number;
    rssAfterLoadBytes: number;
    rssAfterBytes: number;
    rssPeakBytes: number;
    vramBeforeBytes: number | null;
    vramAfterLoadBytes: number | null;
    vramAfterBytes: number | null;
    vramPeakBytes: number | null;
    vramTotalBytes: number | null;
}

export interface BenchmarkReport {
    generatedAt: string;
    profile: HardwareProfile;
    provider: BenchmarkProvider;
    requestedProvider: BenchmarkProvider;
    fallbackReason: string | null;
    fixtureVariant: BenchmarkFixtureVariant;
    threads: number;
    revision: string;
    modelDir: string;
    warmupRequests: number;
    measuredRequests: number;
    inputTokens: number | null;
    latency: LatencyStatistics | null;
    memory: BenchmarkMemoryReport;
    soak: BenchmarkSoakReport | null;
}

export type BenchmarkFailureKind =
    'INVALID_OPTIONS' | 'MODEL_LOAD_FAILED' | 'INFERENCE_FAILED' | 'MODEL_CLOSE_FAILED';

export interface BenchmarkFailure {
    kind: BenchmarkFailureKind;
    provider: BenchmarkProvider;
    message: string;
}

export interface BenchmarkRunnerOptions {
    profile: HardwareProfile;
    provider: BenchmarkProvider;
    fixtureVariant: BenchmarkFixtureVariant;
    threads: number;
    revision: string;
    cacheDir: string;
    modelDir: string | null;
    warmupRequests: number;
    measuredRequests: number;
    soakDurationMilliseconds: number;
    soakIntervalMilliseconds: number;
    webgpu?: BenchmarkWebGpuOptions;
    logSeverityLevel?: 0 | 1 | 2 | 3 | 4;
    fallbackToCpu?: boolean;
    onDownloadProgress?: (progress: DownloadProgress) => void;
}

import { attemptAsync, type Result } from '@ticrafter/core';

import type {
    ScenarioDefinition,
    ScenarioDriver,
    ScenarioResult,
    ScenarioRunner,
} from '../scenario-runner/index.js';

export interface SoakSnapshot {
    rssBytes: number;
    activeClaims: number;
    lastHeartbeatAt: string | null;
}

export interface SoakProbePort {
    snapshot(): SoakSnapshot;
}

export interface SoakClock {
    now(): number;
    sleep(milliseconds: number): Promise<void>;
}

export interface SoakOptions {
    durationMilliseconds: number;
    sampleIntervalMilliseconds: number;
    maximumRssGrowthBytes?: number;
}

export interface SoakReport {
    durationMilliseconds: number;
    samples: number;
    rssStartBytes: number;
    rssEndBytes: number;
    rssPeakBytes: number;
    claimDrift: number;
    heartbeatStable: boolean;
    completed: boolean;
    scenarios: readonly ScenarioResult[];
    reasons: readonly string[];
}

export class SoakRunner {
    constructor(
        private readonly runner: ScenarioRunner,
        private readonly probe: SoakProbePort,
        private readonly clock: SoakClock,
    ) {}

    async run(
        definition: ScenarioDefinition,
        options: SoakOptions,
    ): Promise<Result<SoakReport, string>> {
        const started = this.clock.now();
        const deadline = started + options.durationMilliseconds;
        const samples: SoakSnapshot[] = [this.probe.snapshot()];
        const scenarios: ScenarioResult[] = [];
        while (this.clock.now() < deadline) {
            const [scenario, scenarioError] = await attemptAsync<Result<ScenarioResult, string>>(
                () => this.runner.run(definition),
            );
            if (scenarioError) return [null, SoakRunner.describe(scenarioError)];
            if (scenario === null) return [null, 'soak scenario returned null'];
            const [result, runError] = scenario;
            if (runError) return [null, runError];
            if (result !== null) scenarios.push(result);
            await this.clock.sleep(options.sampleIntervalMilliseconds);
            samples.push(this.probe.snapshot());
        }
        return [this.report(started, samples, scenarios, options), null];
    }

    private report(
        started: number,
        samples: readonly SoakSnapshot[],
        scenarios: readonly ScenarioResult[],
        options: SoakOptions,
    ): SoakReport {
        return buildReport(started, this.clock.now(), samples, scenarios, options);
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class PersistentSoakRunner {
    constructor(
        private readonly driver: ScenarioDriver,
        private readonly probe: SoakProbePort,
        private readonly clock: SoakClock,
    ) {}

    async run(
        definition: ScenarioDefinition,
        options: SoakOptions,
    ): Promise<Result<SoakReport, string>> {
        const started = this.clock.now();
        const deadline = started + options.durationMilliseconds;
        const [startedEnvironment, startError] = this.driver.start(definition);
        if (startError) return [null, startError];
        if (startedEnvironment === null) return [null, 'soak start returned null'];
        const samples: SoakSnapshot[] = [this.probe.snapshot()];
        const scenarios: ScenarioResult[] = [];
        let runError: string | null = null;
        const [, loopException] = await attemptAsync(async () => {
            while (this.clock.now() < deadline) {
                const sampleStartedAt = this.clock.now();
                const [runResult, exception] = await attemptAsync<Result<ScenarioResult, string>>(
                    async () => {
                        const [observation, observationError] = await this.driver.run(definition);
                        if (observationError) return [null, observationError];
                        if (observation === null) return [null, 'soak observation returned null'];
                        return [
                            {
                                ...observation,
                                id: definition.id,
                                durationMilliseconds: this.clock.now() - sampleStartedAt,
                            },
                            null,
                        ];
                    },
                );
                if (exception) {
                    runError = PersistentSoakRunner.describe(exception);
                    break;
                }
                if (runResult === null) {
                    runError = 'soak run returned null';
                    break;
                }
                const [result, resultError] = runResult;
                if (resultError) {
                    runError = resultError;
                    break;
                }
                if (result !== null) scenarios.push(result);
                await this.clock.sleep(options.sampleIntervalMilliseconds);
                samples.push(this.probe.snapshot());
            }
        });
        const [, stopError] = await this.driver.stop(definition);
        if (loopException !== null) {
            return [null, PersistentSoakRunner.describe(loopException)];
        }
        if (runError !== null) return [null, runError];
        if (stopError !== null) return [null, stopError];
        return [buildReport(started, this.clock.now(), samples, scenarios, options), null];
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

function buildReport(
    started: number,
    ended: number,
    samples: readonly SoakSnapshot[],
    scenarios: readonly ScenarioResult[],
    options: SoakOptions,
): SoakReport {
    const rssValues = samples.map((sample) => sample.rssBytes);
    const firstClaimCount = samples[0]?.activeClaims ?? 0;
    const claimDrift = samples.reduce(
        (maximum, sample) => Math.max(maximum, Math.abs(sample.activeClaims - firstClaimCount)),
        0,
    );
    const rssStartBytes = rssValues[0] ?? 0;
    const rssEndBytes = rssValues.at(-1) ?? 0;
    const rssPeakBytes = rssValues.length === 0 ? 0 : Math.max(...rssValues);
    const growthLimit = options.maximumRssGrowthBytes ?? 256 * 1024 * 1024;
    const reasons: string[] = [];
    if (rssEndBytes - rssStartBytes > growthLimit) reasons.push('rss growth exceeded limit');
    if (claimDrift > 0) reasons.push('claim drift detected');
    if (samples.some((sample) => sample.lastHeartbeatAt === null)) {
        reasons.push('heartbeat missing');
    }
    return {
        durationMilliseconds: ended - started,
        samples: samples.length,
        rssStartBytes,
        rssEndBytes,
        rssPeakBytes,
        claimDrift,
        heartbeatStable: !reasons.includes('heartbeat missing'),
        completed: ended >= started + options.durationMilliseconds,
        scenarios,
        reasons,
    };
}

export * from './fleet-probe.js';

import fileSystem from 'node:fs';
import path from 'node:path';

import { attempt, type Result } from '@ticrafter/core';

import type { AssertionResult } from '../behavior-assertions/index.js';
import type { TraceEvent } from './trace-recorder.js';

export interface StoredEventArtifact {
    type: string;
    botId: string | null;
    at: string;
    payload: unknown;
}

export interface StoredBlockArtifact {
    botId: string;
    position: { x: number; y: number; z: number };
    authorized: boolean;
    at: string;
}

export interface ScenarioArtifacts {
    scenarioId: string;
    passed: boolean;
    reasons: readonly string[];
    assertions: readonly AssertionResult[];
    trace: readonly TraceEvent[];
    events: readonly StoredEventArtifact[];
    blocks: readonly StoredBlockArtifact[];
    metrics: Readonly<Record<string, number>>;
}

export class ArtifactWriter {
    static write(directory: string, artifacts: ScenarioArtifacts): Result<void, string> {
        const [, directoryError] = attempt(() =>
            fileSystem.mkdirSync(directory, { recursive: true }),
        );
        if (directoryError) return [null, ArtifactWriter.describe(directoryError)];
        const [, metricsError] = ArtifactWriter.writeJson(path.join(directory, 'metrics.json'), {
            metrics: artifacts.metrics,
        });
        if (metricsError) return [null, metricsError];
        const [, eventsError] = ArtifactWriter.writeJson(path.join(directory, 'events.json'), {
            events: artifacts.events,
            blocks: artifacts.blocks,
        });
        if (eventsError) return [null, eventsError];
        const [, reportError] = ArtifactWriter.writeJson(path.join(directory, 'report.json'), {
            scenarioId: artifacts.scenarioId,
            passed: artifacts.passed,
            reasons: artifacts.reasons,
            assertions: artifacts.assertions,
            metrics: artifacts.metrics,
        });
        if (reportError) return [null, reportError];
        const trace = artifacts.trace.map((entry) => JSON.stringify(entry)).join('\n');
        const [, traceError] = attempt(() =>
            fileSystem.writeFileSync(
                path.join(directory, 'trace.jsonl'),
                trace.length === 0 ? '' : `${trace}\n`,
            ),
        );
        if (traceError) return [null, ArtifactWriter.describe(traceError)];
        if (artifacts.passed) return [undefined, null];
        const [, markdownError] = attempt(() =>
            fileSystem.writeFileSync(
                path.join(directory, 'report.md'),
                ArtifactWriter.markdown(artifacts),
            ),
        );
        return markdownError === null
            ? [undefined, null]
            : [null, ArtifactWriter.describe(markdownError)];
    }

    private static writeJson(filePath: string, payload: unknown): Result<void, string> {
        const [, error] = attempt(() =>
            fileSystem.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`),
        );
        return error === null ? [undefined, null] : [null, ArtifactWriter.describe(error)];
    }

    private static markdown(artifacts: ScenarioArtifacts): string {
        const lines = [
            `# ${artifacts.scenarioId}`,
            '',
            `Passed: ${artifacts.passed}`,
            '',
            '## Failed assertions',
            '',
            ...artifacts.assertions
                .filter((assertion) => !assertion.passed)
                .map(
                    (assertion) =>
                        `- ${assertion.id}: ${assertion.message} (expected ${JSON.stringify(
                            assertion.expected,
                        )}, actual ${JSON.stringify(assertion.actual)})`,
                ),
            '',
            '## Reasons',
            '',
            ...artifacts.reasons.map((reason) => `- ${reason}`),
            '',
        ];
        return lines.join('\n');
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

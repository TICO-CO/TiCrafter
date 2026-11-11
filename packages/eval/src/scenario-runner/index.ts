import { attemptAsync, type Result } from '@ticrafter/core';

import type { EvalMetrics } from '../metrics-reporter/index.js';
import type { MetricsReporter } from '../metrics-reporter/index.js';

export * from './fleet-database.js';
export * from './fleet-driver.js';

export type ScenarioBotRole = 'builder' | 'farmer' | 'miner' | 'scout' | 'hauler' | 'guard';

export interface ScenarioBot {
    name: string;
    role: ScenarioBotRole;
}

export interface ScenarioTaskSeed {
    id: string;
    title: string;
    skillId: string;
    payload?: Readonly<Record<string, unknown>>;
    requiredRole?: ScenarioBotRole | null;
    target?: { x: number; y: number; z: number } | null;
}

export interface ScenarioDefinition {
    id: string;
    title: string;
    bots: readonly ScenarioBot[];
    timeoutMilliseconds: number;
    tasks?: readonly ScenarioTaskSeed[];
}

export interface ScenarioObservation {
    passed: boolean;
    reasons: readonly string[];
    events: number;
    duplicates: number;
    claimConflicts: number;
}

export interface ScenarioDriver {
    start(definition: ScenarioDefinition): Result<void, string>;
    run(definition: ScenarioDefinition): Promise<Result<ScenarioObservation, string>>;
    stop(definition: ScenarioDefinition): Result<void, string>;
}

export interface ScenarioResult extends ScenarioObservation {
    id: string;
    durationMilliseconds: number;
}

export class ScenarioRunner {
    constructor(
        private readonly driver: ScenarioDriver,
        private readonly metrics: EvalMetrics | null = null,
        private readonly reporter: MetricsReporter | null = null,
        private readonly now: () => number = Date.now,
    ) {}

    async run(definition: ScenarioDefinition): Promise<Result<ScenarioResult, string>> {
        const started = this.now();
        const [startedEnvironment, startError] = this.driver.start(definition);
        if (startError) return [null, startError];
        if (startedEnvironment === null) return [null, 'scenario start returned null'];

        const [runResult, runException] = await attemptAsync<Result<ScenarioObservation, string>>(
            () => this.driver.run(definition),
        );
        const [, stopError] = this.driver.stop(definition);
        if (stopError) return [null, stopError];
        if (runException) return [null, ScenarioRunner.describe(runException)];
        if (runResult === null) return [null, 'scenario run returned null'];
        const [observation, observationError] = runResult;
        if (observationError) return [null, observationError];
        if (observation === null) return [null, 'scenario observation returned null'];

        const result: ScenarioResult = {
            ...observation,
            id: definition.id,
            durationMilliseconds: this.now() - started,
        };
        this.record(result);
        const [reported, reportError] = this.reporter?.report() ?? [undefined, null];
        if (reportError) return [null, reportError];
        if (reported === null) return [null, 'scenario metrics report returned null'];
        return [result, null];
    }

    private record(result: ScenarioResult): void {
        this.metrics?.observe('scenario_duration_ms', result.durationMilliseconds, {
            scenario: result.id,
        });
        this.metrics?.gauge('scenario_passed', result.passed ? 1 : 0, { scenario: result.id });
        this.metrics?.increment(
            'scenario_duplicate_work_total',
            { scenario: result.id },
            result.duplicates,
        );
        this.metrics?.increment(
            'scenario_claim_conflicts_total',
            { scenario: result.id },
            result.claimConflicts,
        );
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class ScenarioCatalog {
    static definitions(): readonly ScenarioDefinition[] {
        const builder = (name: string): ScenarioBot => ({ name, role: 'builder' });
        return [
            ScenarioCatalog.definition(
                'house-build',
                'Three bots build one house without duplicate blocks',
                [builder('TiBot1'), builder('TiBot2'), builder('TiBot3')],
            ),
            ScenarioCatalog.definition(
                'farm-race',
                'Two bots race for one farm plot; only one proceeds',
                [
                    { name: 'TiBot1', role: 'farmer' },
                    { name: 'TiBot2', role: 'farmer' },
                ],
            ),
            ScenarioCatalog.definition(
                'road-segments',
                'Road built by multiple bots from partitioned segments',
                [builder('TiBot1'), builder('TiBot2'), builder('TiBot3')],
            ),
            ScenarioCatalog.definition(
                'storage-reservations',
                'Shared storage deposit and withdraw with reservations',
                [
                    { name: 'TiBot1', role: 'hauler' },
                    { name: 'TiBot2', role: 'builder' },
                ],
            ),
            ScenarioCatalog.definition(
                'nearby-edit-safety',
                'One bot edits an existing build while another is nearby',
                [builder('TiBot1'), builder('TiBot2')],
            ),
            ScenarioCatalog.definition(
                'compatible-helper',
                'Compatible edit grant is allowed and merged without duplicate work',
                [builder('TiBot1'), builder('TiBot2')],
            ),
            ScenarioCatalog.definition(
                'incompatible-edit',
                'Incompatible edit request is denied with a reason',
                [builder('TiBot1'), builder('TiBot2')],
            ),
            ScenarioCatalog.definition(
                'owner-offline',
                'Owner-offline edit defaults to deny unless compatible and enabled',
                [builder('TiBot1'), builder('TiBot2')],
            ),
            ScenarioCatalog.definition(
                'design-revision-bump',
                'Design revision bump invalidates outstanding grants',
                [builder('TiBot1'), builder('TiBot2')],
            ),
            ScenarioCatalog.definition(
                'bot-restart-resume',
                'Killed bot restarts, resumes task, lease, and checkpoint',
                [builder('TiBot1')],
            ),
            ScenarioCatalog.definition(
                'coordinator-restart',
                'Coordinator restart reconnects bots and recovers leases',
                [builder('TiBot1'), builder('TiBot2')],
            ),
            ScenarioCatalog.definition(
                'eight-bot-contention',
                'Eight-bot claim, decision queue, and no deadlock test',
                [
                    builder('TiBot1'),
                    builder('TiBot2'),
                    builder('TiBot3'),
                    builder('TiBot4'),
                    { name: 'TiBot5', role: 'miner' },
                    { name: 'TiBot6', role: 'miner' },
                    { name: 'TiBot7', role: 'hauler' },
                    { name: 'TiBot8', role: 'hauler' },
                ],
            ),
        ];
    }

    private static definition(
        id: string,
        title: string,
        bots: readonly ScenarioBot[],
    ): ScenarioDefinition {
        return { id, title, bots, timeoutMilliseconds: 120_000 };
    }
}

import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { EvalMetrics } from '../metrics-reporter/index.js';
import {
    ScenarioCatalog,
    type ScenarioDefinition,
    type ScenarioDriver,
    type ScenarioObservation,
    ScenarioRunner,
} from './index.js';

class FakeDriver implements ScenarioDriver {
    started = 0;
    stopped = 0;

    start(_definition: ScenarioDefinition): Result<void, string> {
        this.started += 1;
        return [undefined, null];
    }

    run(_definition: ScenarioDefinition): Promise<Result<ScenarioObservation, string>> {
        return Promise.resolve([
            {
                passed: true,
                reasons: [],
                events: 12,
                duplicates: 0,
                claimConflicts: 1,
            },
            null,
        ]);
    }

    stop(_definition: ScenarioDefinition): Result<void, string> {
        this.stopped += 1;
        return [undefined, null];
    }
}

describe('ScenarioRunner', () => {
    it('runs a scenario, records metrics, and stops the driver', async () => {
        const driver = new FakeDriver();
        const metrics = new EvalMetrics();
        const runner = new ScenarioRunner(driver, metrics, null, () => 1000);
        const definition = ScenarioCatalog.definitions()[0];

        const [result, runError] = await runner.run(definition as ScenarioDefinition);

        expect(runError).toBeNull();
        expect(result?.passed).toBe(true);
        expect(driver.started).toBe(1);
        expect(driver.stopped).toBe(1);
        expect(metrics.snapshot().some((metric) => metric.name === 'scenario_passed')).toBe(true);
    });
});

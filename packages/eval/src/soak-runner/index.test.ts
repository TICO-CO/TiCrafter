import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import {
    type ScenarioDefinition,
    type ScenarioDriver,
    type ScenarioObservation,
    ScenarioRunner,
} from '../scenario-runner/index.js';
import { type SoakClock, SoakRunner, type SoakSnapshot } from './index.js';

class FakeDriver implements ScenarioDriver {
    start(_definition: ScenarioDefinition): Result<void, string> {
        return [undefined, null];
    }

    run(_definition: ScenarioDefinition): Promise<Result<ScenarioObservation, string>> {
        return Promise.resolve([
            {
                passed: true,
                reasons: [],
                events: 1,
                duplicates: 0,
                claimConflicts: 0,
            },
            null,
        ]);
    }

    stop(_definition: ScenarioDefinition): Result<void, string> {
        return [undefined, null];
    }
}

class FakeClock implements SoakClock {
    private current = 0;

    now(): number {
        return this.current;
    }

    sleep(milliseconds: number): Promise<void> {
        this.current += milliseconds;
        return Promise.resolve();
    }
}

describe('SoakRunner', () => {
    it('samples until the duration elapses', async () => {
        const clock = new FakeClock();
        const runner = new ScenarioRunner(new FakeDriver(), null, null, () => clock.now());
        let snapshots = 0;
        const sink: SoakSnapshot = {
            rssBytes: 0,
            activeClaims: 1,
            lastHeartbeatAt: '2026-11-11T10:00:00.000Z',
        };
        const soak = new SoakRunner(
            runner,
            {
                snapshot: () => {
                    snapshots += 1;
                    return { ...sink, rssBytes: snapshots * 10 };
                },
            },
            clock,
        );

        const [report, runError] = await soak.run(
            {
                id: 'house-build',
                title: 'Test',
                bots: [],
                timeoutMilliseconds: 1000,
            },
            {
                durationMilliseconds: 100,
                sampleIntervalMilliseconds: 50,
            },
        );

        expect(runError).toBeNull();
        expect(report?.completed).toBe(true);
        expect(report?.samples).toBe(3);
        expect(report?.heartbeatStable).toBe(true);
    });
});

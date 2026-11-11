import type { LoggerPort, Result } from '@ticrafter/core';
import type { PlannerCycleResult, PlannerFailure, PlannerTrigger } from '@ticrafter/planning';
import { PlannerTriggerEvaluator } from '@ticrafter/planning';
import { describe, expect, it } from 'bun:test';

import type { PlannerApplyReport, PlannerCycleApplierPort } from './cycle-applier.js';
import { type PlannerCycleSource, PlannerRuntime } from './planner-runtime.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

class FakeCycleSource implements PlannerCycleSource {
    calls = 0;

    constructor(private readonly result: Result<PlannerCycleResult, PlannerFailure>) {}

    async plan(
        _trigger: PlannerTrigger,
        _signal?: AbortSignal,
    ): Promise<Result<PlannerCycleResult, PlannerFailure>> {
        this.calls += 1;
        return this.result;
    }
}

class FakeApplier implements PlannerCycleApplierPort {
    calls = 0;

    constructor(private readonly result: Result<PlannerApplyReport, string>) {}

    apply(_cycle: PlannerCycleResult): Result<PlannerApplyReport, string> {
        this.calls += 1;
        return this.result;
    }
}

function cycle(): PlannerCycleResult {
    return {
        source: 'planner',
        plan: null,
        applicable: true,
        sipProposal: null,
        taskProposals: [],
        taskCancellations: [],
        attempts: 1,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        failure: null,
    };
}

describe('PlannerRuntime', () => {
    it('applies a successful planner cycle', async () => {
        const source = new FakeCycleSource([cycle(), null]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0, tasksCancelled: 0 },
            null,
        ]);
        const runtime = new PlannerRuntime({
            service: source,
            triggers: new PlannerTriggerEvaluator({ intervalMilliseconds: 0 }),
            applier,
            logger,
        });
        runtime.tick();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(source.calls).toBe(1);
        expect(applier.calls).toBe(1);
    });

    it('triggers work-gap cycles after the interval', async () => {
        const source = new FakeCycleSource([cycle(), null]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0, tasksCancelled: 0 },
            null,
        ]);
        const runtime = new PlannerRuntime({
            service: source,
            triggers: new PlannerTriggerEvaluator({
                intervalMilliseconds: 100_000,
                workGapCooldownMilliseconds: 10_000,
            }),
            applier,
            logger,
        });
        runtime.tick(4, 4);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(source.calls).toBe(1);
        runtime.tick(3, 4);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(source.calls).toBe(2);
        runtime.tick(2, 4);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(source.calls).toBe(2);
    });

    it('runs the pre-cycle audit before planning', async () => {
        let audits = 0;
        const source = new FakeCycleSource([cycle(), null]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0, tasksCancelled: 0 },
            null,
        ]);
        const runtime = new PlannerRuntime({
            service: source,
            triggers: new PlannerTriggerEvaluator({ intervalMilliseconds: 0 }),
            applier,
            beforeCycle: () => {
                audits += 1;
                return [undefined, null];
            },
            logger,
        });
        runtime.tick();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(audits).toBe(1);
        expect(source.calls).toBe(1);
    });

    it('does not apply when the planner cycle fails', async () => {
        const source = new FakeCycleSource([null, { type: 'DISABLED', message: 'off' }]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0, tasksCancelled: 0 },
            null,
        ]);
        const runtime = new PlannerRuntime({
            service: source,
            triggers: new PlannerTriggerEvaluator({ intervalMilliseconds: 0 }),
            applier,
            logger,
        });
        runtime.tick();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(source.calls).toBe(1);
        expect(applier.calls).toBe(0);
    });

    it('logs nested validation issues', async () => {
        const payloads: unknown[] = [];
        const failingCycle: PlannerCycleResult = {
            ...cycle(),
            source: 'none',
            applicable: false,
            failure: {
                type: 'REPAIR_EXHAUSTED',
                attempts: 3,
                failure: { type: 'SEMANTIC', issues: ['unknown skill bogus'] },
            },
        };
        const source = new FakeCycleSource([failingCycle, null]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0, tasksCancelled: 0 },
            null,
        ]);
        const runtime = new PlannerRuntime({
            service: source,
            triggers: new PlannerTriggerEvaluator({ intervalMilliseconds: 0 }),
            applier,
            logger: {
                ...logger,
                info: (payload) => payloads.push(payload),
            },
        });
        runtime.tick();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(payloads.length).toBe(1);
        expect((JSON.stringify(payloads[0]) ?? '').includes('unknown skill bogus')).toBe(true);
    });
});

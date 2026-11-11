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
        attempts: 1,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        failure: null,
    };
}

describe('PlannerRuntime', () => {
    it('applies a successful planner cycle', async () => {
        const source = new FakeCycleSource([cycle(), null]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0 },
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

    it('does not apply when the planner cycle fails', async () => {
        const source = new FakeCycleSource([null, { type: 'DISABLED', message: 'off' }]);
        const applier = new FakeApplier([
            { sipRevision: null, tasksCreated: 0, tasksSkipped: 0 },
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
});

import type { ActionDispatchPort, ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import type { SafetyDecision } from '@ticrafter/safety';
import { describe, expect, it } from 'bun:test';

import { ActionExecutor, type ActionGuardian } from './action-executor.js';

class FakeGuardian implements ActionGuardian {
    readonly vetoes: { request: ActionRequest; reason: string }[] = [];
    decision: SafetyDecision = { allowed: true, signals: [] };

    evaluate(): SafetyDecision {
        return this.decision;
    }

    recordVeto(request: ActionRequest, reason: string): void {
        this.vetoes.push({ request, reason });
    }
}

class FakeDispatch implements ActionDispatchPort {
    readonly dispatched: ActionRequest[] = [];
    readonly polled: string[] = [];
    readonly cancelled: string[] = [];

    dispatch(request: ActionRequest): Result<string, string> {
        this.dispatched.push(request);
        return ['handle-1', null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        this.polled.push(handleId);
        return [null, null];
    }

    cancel(handleId: string): Result<void, string> {
        this.cancelled.push(handleId);
        return [undefined, null];
    }
}

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

describe('action executor', () => {
    it('records vetoes and prevents dispatch when the guardian denies', () => {
        const guardian = new FakeGuardian();
        guardian.decision = {
            allowed: false,
            reason: 'hazard',
            signals: [],
            recovery: { kind: 'safe-mode', reason: 'hazard' },
        };
        const dispatch = new FakeDispatch();
        const executor = new ActionExecutor(guardian, dispatch, logger);
        const request = { kind: 'break-block', position: { x: 1, y: 64, z: 0 } } as const;

        const [handle, error] = executor.dispatch(request);

        expect(handle).toBeNull();
        expect(error).toBe('hazard');
        expect(dispatch.dispatched).toEqual([]);
        expect(guardian.vetoes).toEqual([{ request, reason: 'hazard' }]);
    });

    it('preserves dispatch, poll, and cancel semantics when allowed', () => {
        const guardian = new FakeGuardian();
        const dispatch = new FakeDispatch();
        const executor = new ActionExecutor(guardian, dispatch, logger);
        const request = { kind: 'wait', milliseconds: 1 } as const;

        const [handle, dispatchError] = executor.dispatch(request);
        const [outcome, pollError] = executor.poll('handle-1');
        const [cancelled, cancelError] = executor.cancel('handle-1');

        expect(dispatchError).toBeNull();
        expect(handle).toBe('handle-1');
        expect(dispatch.dispatched).toEqual([request]);
        expect(pollError).toBeNull();
        expect(outcome).toBeNull();
        expect(dispatch.polled).toEqual(['handle-1']);
        expect(cancelError).toBeNull();
        expect(cancelled).toBe(undefined);
        expect(dispatch.cancelled).toEqual(['handle-1']);
    });
});

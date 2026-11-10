import type { ActionDispatchPort, ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { CheckpointManager } from './checkpoint-manager.js';
import { EffectsEmitter } from './effects-emitter.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { MemoryCheckpointStore } from './memory-checkpoint-store.js';
import { PreemptionHandler } from './preemption-handler.js';
import { SkillRegistry } from './registry.js';
import { SkillCatalog } from './skill-catalog.js';
import type { SkillContext, SkillWorldView } from './types.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return 'stone';
    }

    nearestContainer(): null {
        return null;
    }
}

class FakeDispatch implements ActionDispatchPort {
    lastHandle: string | null = null;
    lastRequest: ActionRequest | null = null;
    outcome: ActionOutcome | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        this.lastHandle = 'handle-1';
        this.lastRequest = request;
        this.outcome = null;
        return [this.lastHandle, null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        if (handleId !== this.lastHandle) return [null, 'unknown handle'];
        return [this.outcome, null];
    }

    cancel(): Result<void, string> {
        return [undefined, null];
    }

    complete(request: ActionRequest): void {
        this.outcome = { request, status: 'completed' };
    }
}

function context(): SkillContext {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-10T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [{ name: 'bread', count: 2 }],
        world: new FakeWorld(),
        nearestHostile: null,
        lastAction: null,
    };
}

function executor(dispatch: FakeDispatch, checkpoints?: CheckpointManager) {
    const [registry, registryError] = SkillCatalog.createRegistry();
    expect(registryError).toBeNull();
    return new SkillLifecycleExecutor({
        registry: registry ?? new SkillRegistry(),
        dispatch,
        effects: new EffectsEmitter(),
        ...(checkpoints === undefined ? {} : { checkpoints }),
    });
}

describe('skill lifecycle', () => {
    it('runs navigation to completion', () => {
        const dispatch = new FakeDispatch();
        const lifecycle = executor(dispatch);
        const [started, startError] = lifecycle.start(
            'navigate',
            { target: { x: 4, y: 64, z: 0 } },
            context(),
        );
        expect(startError).toBeNull();
        expect(started?.status).toBe('running');
        expect(dispatch.lastRequest?.kind).toBe('move-to');

        dispatch.complete(dispatch.lastRequest as ActionRequest);
        const [completed, advanceError] = lifecycle.advance(context());
        expect(advanceError).toBeNull();
        expect(completed?.status).toBe('completed');
        expect(lifecycle.activeSkillId).toBeNull();
    });

    it('runs mine and collect phases', () => {
        const dispatch = new FakeDispatch();
        const lifecycle = executor(dispatch);
        const [started] = lifecycle.start('mine', { target: { x: 1, y: 64, z: 0 } }, context());
        expect(started?.action?.kind).toBe('break-block');

        dispatch.complete(dispatch.lastRequest as ActionRequest);
        const [collecting] = lifecycle.advance(context());
        expect(collecting?.action?.kind).toBe('collect-drops');

        dispatch.complete(dispatch.lastRequest as ActionRequest);
        const [completed] = lifecycle.advance(context());
        expect(completed?.status).toBe('completed');
    });

    it('saves checkpoints and cancels on preemption', () => {
        const dispatch = new FakeDispatch();
        const manager = new CheckpointManager(new MemoryCheckpointStore());
        const lifecycle = executor(dispatch, manager);
        const state = context();
        lifecycle.start('navigate', { target: { x: 4, y: 64, z: 0 } }, state);
        expect(lifecycle.checkpoint(state)[1]).toBeNull();
        const [checkpoint, loadError] = manager.load('bot.tibot1', 'navigate');
        expect(loadError).toBeNull();
        expect(checkpoint?.state.target).toEqual({ x: 4, y: 64, z: 0 });

        const [cancelled, cancelError] = new PreemptionHandler(lifecycle).preempt(
            state,
            'guardian',
        );
        expect(cancelError).toBeNull();
        expect(cancelled?.status).toBe('cancelled');
        expect(lifecycle.activeSkillId).toBeNull();
    });
});

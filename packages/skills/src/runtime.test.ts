import type {
    ActionDispatchPort,
    ActionFailureClass,
    ActionOutcome,
    ActionRequest,
    Result,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { CheckpointManager } from './checkpoint-manager.js';
import { EffectsEmitter } from './effects-emitter.js';
import { SkillLifecycleExecutor } from './lifecycle-executor.js';
import { MemoryCheckpointStore } from './memory-checkpoint-store.js';
import { PreemptionHandler } from './preemption-handler.js';
import { SkillRegistry } from './registry.js';
import { RestoreValidator } from './restore-validator.js';
import { SkillCatalog } from './skill-catalog.js';
import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
    SkillWorldView,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return 'stone';
    }

    nearestContainer(): null {
        return null;
    }
}

class FakeDispatch implements ActionDispatchPort {
    readonly requests: ActionRequest[] = [];
    lastHandle: string | null = null;
    lastRequest: ActionRequest | null = null;
    outcome: ActionOutcome | null = null;
    dispatchError: string | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        if (this.dispatchError !== null) return [null, this.dispatchError];
        this.requests.push(request);
        this.lastRequest = request;
        this.lastHandle = `handle-${this.requests.length}`;
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

    fail(request: ActionRequest, failureClass: ActionFailureClass, message: string): void {
        this.outcome = {
            request,
            status: 'failed',
            message,
            failure: { class: failureClass, message },
        };
    }

    cancelOutcome(request: ActionRequest, message: string): void {
        this.outcome = { request, status: 'cancelled', message };
    }
}

class PlanningSkill implements Skill {
    readonly id = 'planning';
    receivedInput: SkillInput | null = null;

    canRun(): Result<boolean, string> {
        return [true, null];
    }

    plan(_context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [{ ...input, count: (input.count ?? 0) + 1 }, null];
    }

    start(_context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        this.receivedInput = input;
        const run: SkillRun = { skillId: this.id, state: { count: input.count ?? 0 } };
        return [
            SkillSharedUtilities.running(run, { kind: 'wait', milliseconds: 1 }, 0, 1, 'waiting'),
            null,
        ];
    }

    step(_context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        return [SkillSharedUtilities.completed(run, 'done'), null];
    }

    cancel(_context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(_context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }
}

class VetoEffects extends EffectsEmitter {
    emit(action: ActionRequest): Result<ActionRequest, string> {
        return [null, `veto rejected ${action.kind}`];
    }
}

interface ExecutorOptions {
    registry?: SkillRegistry;
    checkpoints?: CheckpointManager;
    restoreValidator?: RestoreValidator;
    effects?: EffectsEmitter;
}

function context(overrides: Partial<SkillContext> = {}): SkillContext {
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
        ...overrides,
    };
}

function executor(dispatch: FakeDispatch, options: ExecutorOptions = {}): SkillLifecycleExecutor {
    const [catalog, catalogError] = SkillCatalog.createRegistry();
    expect(catalogError).toBeNull();
    return new SkillLifecycleExecutor({
        registry: options.registry ?? catalog ?? new SkillRegistry(),
        dispatch,
        effects: options.effects ?? new EffectsEmitter(),
        ...(options.checkpoints === undefined ? {} : { checkpoints: options.checkpoints }),
        ...(options.restoreValidator === undefined
            ? {}
            : { restoreValidator: options.restoreValidator }),
    });
}

function checkpointManager(): CheckpointManager {
    return new CheckpointManager(new MemoryCheckpointStore());
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

        if (dispatch.lastRequest === null) return;
        dispatch.complete(dispatch.lastRequest);
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

        if (dispatch.lastRequest === null) return;
        dispatch.complete(dispatch.lastRequest);
        const [collecting] = lifecycle.advance(context());
        expect(collecting?.action?.kind).toBe('collect-drops');

        if (dispatch.lastRequest === null) return;
        dispatch.complete(dispatch.lastRequest);
        const [completed] = lifecycle.advance(context());
        expect(completed?.status).toBe('completed');
    });

    it('starts the planned input produced by plan', () => {
        const skill = new PlanningSkill();
        const registry = new SkillRegistry();
        registry.register(skill);
        const lifecycle = executor(new FakeDispatch(), { registry });
        const [started, startError] = lifecycle.start('planning', { count: 1 }, context());
        expect(startError).toBeNull();
        expect(started?.status).toBe('running');
        expect(skill.receivedInput).toEqual({ count: 2 });
        expect(lifecycle.currentRun?.state.count).toBe(2);
    });

    it('resumes a valid checkpoint by dispatching the next action', () => {
        const manager = checkpointManager();
        const state = context();
        const first = executor(new FakeDispatch(), { checkpoints: manager });
        first.start('navigate', { target: { x: 4, y: 64, z: 0 } }, state);
        const [checkpoint, loadError] = manager.load('bot.tibot1', 'default', 'navigate');
        expect(loadError).toBeNull();
        if (checkpoint === null) return;

        const dispatch = new FakeDispatch();
        const resumedLifecycle = executor(dispatch, {
            checkpoints: manager,
            restoreValidator: new RestoreValidator(),
        });
        const [resumed, resumeError] = resumedLifecycle.resume('navigate', checkpoint, state);
        expect(resumeError).toBeNull();
        expect(resumed?.action).toEqual({
            kind: 'move-to',
            position: { x: 4, y: 64, z: 0 },
            range: 1,
        });
        expect(dispatch.lastRequest?.kind).toBe('move-to');
        expect(resumedLifecycle.activeSkillId).toBe('navigate');
    });

    it('rejects stale and wrong-task checkpoints on resume', () => {
        const state = context();
        const validator = new RestoreValidator();
        const stale: SkillCheckpoint = {
            botId: 'bot.tibot1',
            taskId: 'default',
            skillId: 'navigate',
            state: { target: { x: 4, y: 64, z: 0 }, range: 1 },
            updatedAt: '2026-11-10T11:00:00.000Z',
        };
        const staleLifecycle = executor(new FakeDispatch(), { restoreValidator: validator });
        const [staleStep, staleError] = staleLifecycle.resume('navigate', stale, state);
        expect(staleStep).toBeNull();
        expect(staleError).toBe('checkpoint is stale');
        expect(staleLifecycle.activeSkillId).toBeNull();

        const wrongTask: SkillCheckpoint = {
            ...stale,
            taskId: 'other-task',
            updatedAt: state.at,
        };
        const taskLifecycle = executor(new FakeDispatch(), { restoreValidator: validator });
        const [taskStep, taskError] = taskLifecycle.resume('navigate', wrongTask, state);
        expect(taskStep).toBeNull();
        expect(taskError).toBe('checkpoint belongs to another task');
        expect(taskLifecycle.activeSkillId).toBeNull();
    });

    it('checkpoints and clears the active skill on preemption', () => {
        const dispatch = new FakeDispatch();
        const manager = checkpointManager();
        const lifecycle = executor(dispatch, { checkpoints: manager });
        const state = context();
        lifecycle.start('navigate', { target: { x: 4, y: 64, z: 0 } }, state);

        const [preempted, preemptError] = new PreemptionHandler(lifecycle).preempt(
            state,
            'guardian',
        );
        expect(preemptError).toBeNull();
        expect(preempted?.status).toBe('cancelled');
        expect(preempted?.failure?.class).toBe('preempted');
        expect(lifecycle.activeSkillId).toBeNull();

        const [checkpoint, loadError] = manager.load('bot.tibot1', 'default', 'navigate');
        expect(loadError).toBeNull();
        expect(checkpoint?.state.target).toEqual({ x: 4, y: 64, z: 0 });
    });

    it('clears the active skill when an action outcome is cancelled', () => {
        const dispatch = new FakeDispatch();
        const lifecycle = executor(dispatch);
        const state = context();
        lifecycle.start('navigate', { target: { x: 4, y: 64, z: 0 } }, state);
        if (dispatch.lastRequest === null) return;

        dispatch.cancelOutcome(dispatch.lastRequest, 'cancelled by test');
        const [cancelled, advanceError] = lifecycle.advance(state);
        expect(advanceError).toBeNull();
        expect(cancelled?.status).toBe('cancelled');
        expect(cancelled?.failure?.class).toBe('cancelled');
        expect(lifecycle.activeSkillId).toBeNull();
    });

    it('deletes the checkpoint when a step completes', () => {
        const dispatch = new FakeDispatch();
        const manager = checkpointManager();
        const lifecycle = executor(dispatch, { checkpoints: manager });
        const state = context();
        lifecycle.start('navigate', { target: { x: 4, y: 64, z: 0 } }, state);
        const [before] = manager.load('bot.tibot1', 'default', 'navigate');
        expect(before).not.toBeNull();
        if (dispatch.lastRequest === null) return;

        dispatch.complete(dispatch.lastRequest);
        const [completed, advanceError] = lifecycle.advance(state);
        expect(advanceError).toBeNull();
        expect(completed?.status).toBe('completed');
        const [after, loadError] = manager.load('bot.tibot1', 'default', 'navigate');
        expect(loadError).toBeNull();
        expect(after).toBeNull();
    });

    it('deletes the checkpoint when a step fails', () => {
        const dispatch = new FakeDispatch();
        const manager = checkpointManager();
        const lifecycle = executor(dispatch, { checkpoints: manager });
        const state = context();
        lifecycle.start('navigate', { target: { x: 4, y: 64, z: 0 } }, state);
        const [before] = manager.load('bot.tibot1', 'default', 'navigate');
        expect(before).not.toBeNull();
        if (dispatch.lastRequest === null) return;

        dispatch.fail(dispatch.lastRequest, 'no-path', 'blocked');
        const [failed, advanceError] = lifecycle.advance(state);
        expect(advanceError).toBeNull();
        expect(failed?.status).toBe('failed');
        expect(failed?.failure?.class).toBe('no-path');
        const [after, loadError] = manager.load('bot.tibot1', 'default', 'navigate');
        expect(loadError).toBeNull();
        expect(after).toBeNull();
    });

    it('leaves no active skill when dispatch fails', () => {
        const dispatch = new FakeDispatch();
        dispatch.dispatchError = 'dispatch offline';
        const lifecycle = executor(dispatch);
        const [step, startError] = lifecycle.start(
            'navigate',
            { target: { x: 4, y: 64, z: 0 } },
            context(),
        );
        expect(step).toBeNull();
        expect(startError).toBe('dispatch offline');
        expect(lifecycle.activeSkillId).toBeNull();
    });

    it('leaves no active skill when effect veto fails', () => {
        const lifecycle = executor(new FakeDispatch(), { effects: new VetoEffects() });
        const [step, startError] = lifecycle.start(
            'navigate',
            { target: { x: 4, y: 64, z: 0 } },
            context(),
        );
        expect(step).toBeNull();
        expect(startError).toBe('veto rejected move-to');
        expect(lifecycle.activeSkillId).toBeNull();
    });
});

import type { ActionDispatchPort, ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import {
    MemoryCheckpointStore,
    type SkillContext,
    type SkillContextSource,
    type SkillProgressSink,
    type SkillWorldView,
} from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { SkillHost } from './skill-host.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return 'air';
    }

    nearestContainer(): null {
        return null;
    }
}

class FakeSource implements SkillContextSource {
    read(): Result<Omit<SkillContext, 'lastAction'>, string> {
        return [
            {
                botId: 'bot.tibot1',
                at: new Date().toISOString(),
                position: { x: 0, y: 64, z: 0 },
                health: 20,
                food: 20,
                timeOfDay: 1000,
                isSleeping: false,
                inventory: [],
                world: new FakeWorld(),
                hostiles: [],
                nearestHostile: null,
            },
            null,
        ];
    }
}

class FakeDispatch implements ActionDispatchPort {
    lastRequest: ActionRequest | null = null;
    cancelledHandle: string | null = null;

    dispatch(request: ActionRequest): Result<string, string> {
        this.lastRequest = request;
        return ['handle-1', null];
    }

    poll(): Result<ActionOutcome | null, string> {
        return [null, null];
    }

    cancel(handleId: string): Result<void, string> {
        this.cancelledHandle = handleId;
        return [undefined, null];
    }
}

const silentProgress: SkillProgressSink = {
    report: () => [undefined, null],
};

function createHost(dispatch: FakeDispatch): SkillHost | null {
    const [host, error] = SkillHost.create({
        source: new FakeSource(),
        dispatch,
        progressSink: silentProgress,
        logger: {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        },
        tickMilliseconds: 200,
        checkpointStore: new MemoryCheckpointStore(),
    });
    expect(error).toBeNull();
    return host;
}

describe('skill host', () => {
    it('runs skills with the requested task id', () => {
        const dispatch = new FakeDispatch();
        const host = createHost(dispatch);
        if (host === null) return;
        const [step, runError] = host.run('navigate', {
            target: { x: 4, y: 64, z: 0 },
            taskId: 'task-1',
        });
        expect(runError).toBeNull();
        expect(step?.status).toBe('running');
        expect(dispatch.lastRequest?.kind).toBe('move-to');
        expect(host.activeTaskId).toBe('task-1');
        expect(host.activeSkillId).toBe('navigate');
    });

    it('cancels and resumes from a checkpoint', () => {
        const dispatch = new FakeDispatch();
        const host = createHost(dispatch);
        if (host === null) return;
        host.run('navigate', { target: { x: 4, y: 64, z: 0 }, taskId: 'task-1' });
        const [cancelled, cancelError] = host.cancel('test cancel');
        expect(cancelError).toBeNull();
        expect(cancelled?.status).toBe('cancelled');
        expect(dispatch.cancelledHandle).toBe('handle-1');
        expect(host.activeSkillId).toBeNull();

        const [resumed, resumeError] = host.resume('navigate', 'task-1');
        expect(resumeError).toBeNull();
        expect(resumed?.status).toBe('running');
        expect(dispatch.lastRequest?.kind).toBe('move-to');
    });

    it('rejects resume without a checkpoint', () => {
        const host = createHost(new FakeDispatch());
        if (host === null) return;
        const [step, resumeError] = host.resume('navigate', 'missing-task');
        expect(step).toBeNull();
        expect(String(resumeError).includes('no checkpoint')).toBe(true);
    });

    it('cancels the active skill on stop', () => {
        const dispatch = new FakeDispatch();
        const host = createHost(dispatch);
        if (host === null) return;
        host.run('navigate', { target: { x: 4, y: 64, z: 0 } });
        host.stop();
        expect(dispatch.cancelledHandle).toBe('handle-1');
        expect(host.activeSkillId).toBeNull();
    });
});

import type { Affordance, LayaDecision, PolicyState } from '@ticrafter/brains';
import type { DecisionRequest } from '@ticrafter/core';
import {
    type BotTaskResponse,
    type Envelope,
    type Result,
    TASK_CLAIM,
    TASK_COMPLETE,
    type TransportFailure,
} from '@ticrafter/core';
import type { SkillInput, SkillStep } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import {
    TaskAutonomy,
    type TaskAutonomySnapshot,
    type TaskAutonomyTransportPort,
    type TaskDecisionPort,
    type TaskSkillPort,
} from './task-autonomy.js';

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

class FakeTransport implements TaskAutonomyTransportPort {
    readonly requests: { type: string; payload: unknown }[] = [];

    request(
        type: string,
        payload: unknown,
        _timeoutMilliseconds?: number,
    ): Promise<Result<Envelope, TransportFailure>> {
        this.requests.push({ type, payload });
        if (type === TASK_CLAIM) {
            const response: BotTaskResponse = {
                ok: true,
                taskId: 'task-1',
                task: {
                    id: 'task-1',
                    title: 'Walk north',
                    priority: 1,
                    payload: { skillId: 'navigate', target: { x: 0, y: 64, z: 4 } },
                    target: null,
                    requiredRole: null,
                },
                fencingToken: 7,
                leaseUntil: '2026-11-11T10:01:00.000Z',
            };
            return Promise.resolve([{ payload: response } as Envelope, null]);
        }
        return Promise.resolve([{ payload: { ok: true } } as Envelope, null]);
    }
}

class FakeDecision implements TaskDecisionPort {
    requests: DecisionRequest[] = [];

    decide(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        _state: PolicyState,
    ): Promise<Result<LayaDecision, string>> {
        this.requests.push(request);
        const choice = affordances[0];
        if (choice === undefined) return Promise.resolve([null, 'no choice']);
        return Promise.resolve([
            {
                choice,
                source: 'fallback',
                confidence: 0,
                danger: false,
                shouldContinue: true,
                latencyMilliseconds: 0,
            },
            null,
        ]);
    }
}

class FakeSkills implements TaskSkillPort {
    readonly runs: { skillId: string; input: SkillInput }[] = [];
    activeSkillId: string | null = null;

    run(skillId: string, input: SkillInput): Result<SkillStep, string> {
        this.runs.push({ skillId, input });
        this.activeSkillId = null;
        return [
            {
                run: { skillId, state: {} },
                status: 'completed',
                action: null,
                progress: { done: 1, total: 1, label: 'done' },
                failure: null,
            },
            null,
        ];
    }

    preempt(_reason: string): Result<SkillStep | null, string> {
        this.activeSkillId = null;
        return [null, null];
    }
}

const snapshot: TaskAutonomySnapshot = {
    health: 20,
    food: 20,
    position: { x: 0, y: 64, z: 0 },
    inventory: [],
    hazards: [],
};

const wait = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('TaskAutonomy', () => {
    it('claims a task, asks for a decision, and completes the task', async () => {
        const transport = new FakeTransport();
        const decisions = new FakeDecision();
        const skills = new FakeSkills();
        const autonomy = new TaskAutonomy({
            botId: 'bot.one',
            transport,
            decisions,
            skills,
            snapshot: { read: () => snapshot },
            logger,
            tickMilliseconds: 1000,
        });

        autonomy.start();
        await wait(20);
        autonomy.stop();

        expect(transport.requests.some((request) => request.type === TASK_CLAIM)).toBe(true);
        expect(decisions.requests).toHaveLength(1);
        expect(skills.runs[0]?.skillId).toBe('navigate');
        expect(skills.runs[0]?.input.taskId).toBe('task-1');
        expect(transport.requests.some((request) => request.type === TASK_COMPLETE)).toBe(true);
    });

    it('stops claiming tasks while paused and resumes afterwards', async () => {
        const transport = new FakeTransport();
        const decisions = new FakeDecision();
        const skills = new FakeSkills();
        const autonomy = new TaskAutonomy({
            botId: 'bot.one',
            transport,
            decisions,
            skills,
            snapshot: { read: () => snapshot },
            logger,
            tickMilliseconds: 10,
        });

        autonomy.start();
        await wait(20);
        autonomy.pause('operator pause');
        await wait(20);
        const pausedRequests = transport.requests.length;
        await wait(20);
        expect(transport.requests.length).toBe(pausedRequests);

        autonomy.resume();
        await wait(20);
        autonomy.stop();

        expect(transport.requests.length > pausedRequests).toBe(true);
    });
});

import { NeedsModel, PersonalityModel } from '@ticrafter/agency';
import type { Affordance, LayaDecision, PolicyState } from '@ticrafter/brains';
import type { DecisionRequest } from '@ticrafter/core';
import {
    BOT_JOB_DECIDE,
    BOT_JOB_OFFERS,
    type BotTaskResponse,
    type Envelope,
    type Result,
    type SessionResume,
    TASK_CLAIM,
    TASK_COMPLETE,
    TASK_FAIL,
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
    type TaskTacticalContext,
} from './task-autonomy.js';

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

class FakeTransport implements TaskAutonomyTransportPort {
    readonly requests: { type: string; payload: unknown }[] = [];

    constructor(private readonly projectId: string | null = null) {}

    request(
        type: string,
        payload: unknown,
        _timeoutMilliseconds?: number,
    ): Promise<Result<Envelope, TransportFailure>> {
        this.requests.push({ type, payload });
        if (type === BOT_JOB_OFFERS) {
            return Promise.resolve([
                {
                    payload: {
                        ok: true,
                        offers: [
                            {
                                taskId: 'task-1',
                                title: 'Walk north',
                                priority: 60,
                                skillId: 'navigate',
                                target: null,
                                requiredRole: 'builder',
                                distance: 4,
                                ...(this.projectId === null ? {} : { projectId: this.projectId }),
                            },
                        ],
                    },
                } as Envelope,
                null,
            ]);
        }
        if (type === BOT_JOB_DECIDE) {
            const decision = (payload as { decision?: string }).decision;
            if (decision === 'accept') {
                return Promise.resolve([
                    {
                        payload: {
                            ok: true,
                            taskId: 'task-1',
                            offer: null,
                            task: {
                                id: 'task-1',
                                title: 'Walk north',
                                priority: 1,
                                payload: {
                                    skillId: 'navigate',
                                    target: { x: 0, y: 64, z: 4 },
                                    ...(this.projectId === null
                                        ? {}
                                        : { projectId: this.projectId }),
                                },
                                target: null,
                                requiredRole: null,
                                ...(this.projectId === null ? {} : { projectId: this.projectId }),
                            },
                            fencingToken: 7,
                            leaseUntil: '2026-11-11T10:01:00.000Z',
                        },
                    } as Envelope,
                    null,
                ]);
            }
            return Promise.resolve([{ payload: { ok: true, taskId: 'task-1' } } as Envelope, null]);
        }
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
    status: 'running' | 'completed' = 'completed';

    run(skillId: string, input: SkillInput): Result<SkillStep, string> {
        this.runs.push({ skillId, input });
        this.activeSkillId = this.status === 'running' ? skillId : null;
        return [
            {
                run: { skillId, state: {} },
                status: this.status,
                action: null,
                progress: { done: this.status === 'running' ? 0 : 1, total: 1, label: 'done' },
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

    it('accepts a job offer through the market and completes the task', async () => {
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
            jobMarket: {
                context: () => ({
                    role: 'builder',
                    activeGoal: false,
                    projectFocusId: null,
                    needs: NeedsModel.create()[0] as NeedsModel,
                    traits: PersonalityModel.fromBotIndex(0),
                }),
            },
            tickMilliseconds: 1000,
        });

        autonomy.start();
        await wait(20);
        autonomy.stop();

        expect(transport.requests.some((request) => request.type === BOT_JOB_OFFERS)).toBe(true);
        expect(transport.requests.some((request) => request.type === BOT_JOB_DECIDE)).toBe(true);
        expect(transport.requests.some((request) => request.type === TASK_CLAIM)).toBe(false);
        expect(skills.runs[0]?.input.taskId).toBe('task-1');
        expect(transport.requests.some((request) => request.type === TASK_COMPLETE)).toBe(true);
    });

    it('marks accepted project sub-work without replacing project focus', async () => {
        const transport = new FakeTransport('project-1');
        const decisions = new FakeDecision();
        const skills = new FakeSkills();
        skills.status = 'running';
        const autonomy = new TaskAutonomy({
            botId: 'bot.one',
            transport,
            decisions,
            skills,
            snapshot: { read: () => snapshot },
            logger,
            jobMarket: {
                context: () => ({
                    role: 'builder',
                    activeGoal: false,
                    projectFocusId: 'project-1',
                    needs: NeedsModel.create()[0] as NeedsModel,
                    traits: PersonalityModel.fromBotIndex(0),
                }),
            },
            tickMilliseconds: 1000,
        });

        autonomy.start();
        await wait(20);
        autonomy.stop();

        expect(autonomy.activeTaskProjectId).toBe('project-1');
    });

    it('discards a tactical result after the working-memory revision changes', async () => {
        const transport = new FakeTransport();
        const skills = new FakeSkills();
        let revision = 0;
        const dropped: string[] = [];
        const recorded: string[] = [];
        const context = (): TaskTacticalContext => ({
            revision,
            focus: null,
            commitments: [],
            recentExperiences: [],
            interruption: null,
            strategicGoal: null,
            strategicConstraints: [],
        });
        const decisions: TaskDecisionPort = {
            decide: (request, affordances) => {
                revision = 1;
                const eat = affordances.find((affordance) => affordance.skillId === 'eat');
                if (eat === undefined) return Promise.resolve([null, 'no eat affordance']);
                return Promise.resolve([
                    {
                        choice: eat,
                        source: 'laya',
                        confidence: 0.9,
                        danger: false,
                        shouldContinue: true,
                        latencyMilliseconds: 10,
                    },
                    null,
                ]);
            },
        };
        const autonomy = new TaskAutonomy({
            botId: 'bot.one',
            transport,
            decisions,
            skills,
            snapshot: { read: () => ({ ...snapshot, food: 4 }) },
            logger,
            tacticalContext: context,
            recordTacticalDrop: (input) => dropped.push(input.reason),
            recordTacticalDecision: (input) => recorded.push(input.source),
            tickMilliseconds: 1000,
        });

        autonomy.start();
        await wait(20);
        autonomy.stop();

        expect(dropped).toHaveLength(1);
        expect(recorded).toEqual(['fallback']);
        expect(skills.runs[0]?.skillId).toBe('navigate');
    });

    it('restores a resumed task without claiming a new one', async () => {
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
        const resume: SessionResume = {
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
            checkpoint: { step: 2 },
            sipRevision: 4,
        };

        expect(autonomy.resumeTask(resume)).toBe(true);
        autonomy.start();
        await wait(20);
        autonomy.stop();

        expect(transport.requests.some((request) => request.type === TASK_CLAIM)).toBe(false);
        expect(skills.runs[0]?.skillId).toBe('navigate');
        expect(transport.requests.some((request) => request.type === TASK_COMPLETE)).toBe(true);
    });

    it('maps skill failure classes into task retry classes', async () => {
        const transport = new FakeTransport();
        const autonomy = new TaskAutonomy({
            botId: 'bot.one',
            transport,
            decisions: new FakeDecision(),
            skills: new FakeSkills(),
            snapshot: { read: () => snapshot },
            logger,
        });
        autonomy.resumeTask({
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
            sipRevision: 4,
        });

        autonomy.observeProgress({
            taskId: 'task-1',
            skillId: 'navigate',
            status: 'failed',
            progress: { done: 0, total: 1, label: 'blocked' },
            failureClass: 'no-path',
        });
        await wait(0);

        const failure = transport.requests.find((request) => request.type === TASK_FAIL);
        expect((failure?.payload as { failureClass?: string }).failureClass).toBe('blocked');
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

import {
    type AgencySnapshot,
    AgencyState,
    type AgencyStateSnapshot,
    type Intention,
    NeedsModel,
    PersonalityModel,
} from '@ticrafter/agency';
import type { LoggerPort, Result } from '@ticrafter/core';
import type { SkillFailure, SkillInput, SkillProgressEvent, SkillStep } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { AgencyRuntime, type AgencySkillPort } from './agency-runtime.js';
import type { AgencyEpisodeInput } from './agency-state-adapter.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function snapshot(overrides: Partial<AgencySnapshot> = {}): AgencySnapshot {
    return {
        at: '2026-11-11T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 5,
        timeOfDay: 6000,
        inventory: [{ name: 'bread', count: 2 }],
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: null,
        hasBed: false,
        knownResourceSites: [],
        ...overrides,
    };
}

function skillStep(status: SkillStep['status'], failureClass?: string): SkillStep {
    const failure: SkillFailure | null =
        failureClass === undefined
            ? null
            : { class: failureClass as SkillFailure['class'], message: failureClass };
    return {
        run: { skillId: 'eat', state: {} },
        status,
        action: null,
        progress: { done: status === 'running' ? 0 : 1, total: 1, label: status },
        failure,
    };
}

class FakeSkills implements AgencySkillPort {
    readonly runs: { skillId: string; input: SkillInput }[] = [];
    activeSkillId: string | null = null;
    result: SkillStep = skillStep('running');

    run(skillId: string, input: SkillInput): Result<SkillStep, string> {
        this.runs.push({ skillId, input });
        this.activeSkillId = this.result.status === 'running' ? skillId : null;
        return [this.result, null];
    }

    preempt(): Result<SkillStep | null, string> {
        this.activeSkillId = null;
        return [null, null];
    }
}

interface RuntimeFixture {
    runtime: AgencyRuntime;
    skills: FakeSkills;
    persistence: FakePersistence;
}

class FakePersistence {
    readonly saves: { state: AgencyStateSnapshot; at: string | undefined }[] = [];
    readonly episodes: AgencyEpisodeInput[] = [];

    save(state: AgencyStateSnapshot, at?: string): void {
        this.saves.push({ state, at });
    }

    episode(input: AgencyEpisodeInput): void {
        this.episodes.push(input);
    }
}

function createRuntime(
    options: {
        intention?: Intention;
        isJobActive?: () => boolean;
        isPaused?: () => boolean;
        skills?: FakeSkills;
    } = {},
): RuntimeFixture | null {
    const skills = options.skills ?? new FakeSkills();
    const persistence = new FakePersistence();
    const [needs, needsError] = NeedsModel.create({ hunger: 0.1 });
    expect(needsError).toBeNull();
    if (needs === null) return null;
    const [state, stateError] = AgencyState.create({
        botId: 'bot.one',
        traits: PersonalityModel.fromBotIndex(0),
        needs,
        intention: options.intention ?? null,
    });
    expect(stateError).toBeNull();
    if (state === null) return null;
    const [runtime, runtimeError] = AgencyRuntime.create(
        {
            botId: 'bot.one',
            context: { read: () => [snapshot(), null] },
            skills,
            persistence,
            logger,
            config: {
                enabled: true,
                goalCadenceMilliseconds: 1000,
                needDecayPerMinute: 0.02,
                committedGoalBonus: 0.15,
            },
            isJobActive: options.isJobActive,
            isPaused: options.isPaused,
            now: () => 1000,
            maximumAttempts: 2,
        },
        state,
    );
    expect(runtimeError).toBeNull();
    if (runtime === null) return null;
    return { runtime, skills, persistence };
}

describe('agency runtime', () => {
    it('selects a goal, starts its skill, and completes it', () => {
        const created = createRuntime();
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills, persistence } = created;
        const [report, tickError] = runtime.tick(1000);
        expect(tickError).toBeNull();
        expect(report?.action).toBe('running');
        expect(skills.runs[0]?.skillId).toBe('eat');
        const goalId = persistence.episodes[0]?.goalId;
        expect(goalId).not.toBeNull();
        if (goalId === null || goalId === undefined) return;
        expect(skills.runs[0]?.input.taskId).toBe(goalId);
        skills.activeSkillId = null;
        const event: SkillProgressEvent = {
            botId: 'bot.one',
            taskId: goalId,
            at: '2026-11-11T12:00:01.000Z',
            skillId: 'eat',
            status: 'completed',
            progress: { done: 1, total: 1, label: 'eaten' },
        };
        runtime.observeProgress(event);
        expect(runtime.isIdle).toBe(true);
        expect(persistence.episodes.some((episode) => episode.kind === 'goal.completed')).toBe(
            true,
        );
    });

    it('skips deliberation while a job is active or autonomy is paused', () => {
        const working = createRuntime({ isJobActive: () => true });
        expect(working).not.toBeNull();
        if (working === null) return;
        expect(working.runtime.tick(1000)[0]?.action).toBe('job');
        const paused = createRuntime({ isPaused: () => true });
        expect(paused).not.toBeNull();
        if (paused === null) return;
        expect(paused.runtime.tick(1000)[0]?.action).toBe('paused');
        expect(paused.skills.runs).toHaveLength(0);
    });

    it('retries then abandons a failing goal', () => {
        const skills = new FakeSkills();
        skills.result = skillStep('failed', 'target-missing');
        const created = createRuntime({ skills });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, persistence } = created;
        expect(runtime.tick(1000)[0]?.action).toBe('retry');
        expect(runtime.tick(1000)[0]?.action).toBe('retry');
        expect(runtime.tick(1000)[0]?.action).toBe('abandoned');
        expect(runtime.hasActiveGoal).toBe(false);
        expect(persistence.episodes.some((episode) => episode.kind === 'goal.abandoned')).toBe(
            true,
        );
    });

    it('restores a persisted intention when its goal still exists', () => {
        const intention: Intention = {
            goalId: 'goal:eat:eat-food-to-restore-hunger',
            label: 'Eat food to restore hunger',
            stepIndex: 0,
            createdAt: '2026-11-11T12:00:00.000Z',
            deadline: null,
            attempts: 0,
        };
        const created = createRuntime({ intention });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills } = created;
        const [, restoreError] = runtime.restore();
        expect(restoreError).toBeNull();
        expect(runtime.hasActiveGoal).toBe(true);
        expect(runtime.tick(1000)[0]?.action).toBe('running');
        expect(skills.runs[0]?.skillId).toBe('eat');
    });
});

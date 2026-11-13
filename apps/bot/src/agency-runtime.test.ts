import {
    type AgencySnapshot,
    AgencyState,
    type AgencyStateSnapshot,
    type Intention,
    NeedsModel,
    PersonalityModel,
    type ProjectSummary,
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
        homeBbox: null,
        homeStatus: null,
        homeStructureId: null,
        hasBedAtHome: false,
        isSheltered: false,
        digSite: null,
        weapon: null,
        armorPieces: 0,
        armorInventoryPieces: 0,
        nightIntent: null,
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
    readonly resumes: { skillId: string; taskId: string }[] = [];
    readonly preempts: string[] = [];
    activeSkillId: string | null = null;
    result: SkillStep = skillStep('running');
    resumeResult: Result<SkillStep, string> = [skillStep('running'), null];

    run(skillId: string, input: SkillInput): Result<SkillStep, string> {
        this.runs.push({ skillId, input });
        this.activeSkillId = this.result.status === 'running' ? skillId : null;
        return [this.result, null];
    }

    resume(skillId: string, taskId: string): Result<SkillStep, string> {
        this.resumes.push({ skillId, taskId });
        const [step] = this.resumeResult;
        this.activeSkillId = step?.status === 'running' ? skillId : null;
        return this.resumeResult;
    }

    preempt(reason: string): Result<SkillStep | null, string> {
        this.preempts.push(reason);
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
        isProjectTaskActive?: () => boolean;
        isPaused?: () => boolean;
        skills?: FakeSkills;
        snapshot?: AgencySnapshot;
        project?: ProjectSummary | null;
        reflection?: { enabled: boolean; maxTraitDelta: number };
        progressTimeoutMilliseconds?: number;
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
            context: { read: () => [options.snapshot ?? snapshot(), null] },
            skills,
            persistence,
            logger,
            config: {
                enabled: true,
                goalCadenceMilliseconds: 1000,
                needDecayPerMinute: 0.02,
                committedGoalBonus: 0.15,
                reflection: options.reflection ?? { enabled: false, maxTraitDelta: 0.01 },
                ...(options.progressTimeoutMilliseconds === undefined
                    ? {}
                    : { progressTimeoutMilliseconds: options.progressTimeoutMilliseconds }),
            },
            isJobActive: options.isJobActive,
            isProjectTaskActive: options.isProjectTaskActive,
            isPaused: options.isPaused,
            now: () => 1000,
            maximumAttempts: 2,
        },
        state,
    );
    expect(runtimeError).toBeNull();
    if (runtime === null) return null;
    runtime.syncProjectFocus(
        options.project === undefined || options.project === null ? [] : [options.project],
    );
    return { runtime, skills, persistence };
}

describe('agency runtime', () => {
    it('selects a goal, starts its skill, and completes it', async () => {
        const created = createRuntime();
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills, persistence } = created;
        const [report, tickError] = await runtime.tick(1000);
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

    it('reflects a completed goal into mood and bounded traits', async () => {
        const created = createRuntime({
            reflection: { enabled: true, maxTraitDelta: 0.05 },
        });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills, persistence } = created;
        const before = runtime.traits.weight('orderliness');
        await runtime.tick(1000);
        const goalId = persistence.episodes[0]?.goalId;
        if (goalId === null || goalId === undefined) return;
        skills.activeSkillId = null;
        runtime.observeProgress({
            botId: 'bot.one',
            taskId: goalId,
            at: '2026-11-11T12:00:01.000Z',
            skillId: 'eat',
            status: 'completed',
            progress: { done: 1, total: 1, label: 'eaten' },
        });
        expect(runtime.traits.weight('orderliness') > before).toBe(true);
        expect(persistence.saves.at(-1)?.state.mood).toBe('content');
        expect(
            runtime.workingMemory.recentExperiences.some(
                (experience) => experience.event === 'goal.completed:eat',
            ),
        ).toBe(true);
        const completed = persistence.episodes.find((episode) => episode.kind === 'goal.completed');
        expect(
            (completed?.payload as { reflection?: { mood?: string } } | undefined)?.reflection
                ?.mood,
        ).toBe('content');
    });

    it('reports night readiness when dusk starts', async () => {
        const created = createRuntime({
            snapshot: snapshot({
                timeOfDay: 17_500,
                isSheltered: true,
                hasBedAtHome: true,
                weapon: { name: 'stone_sword', tier: 2 },
                inventory: [{ name: 'bread', count: 3 }],
            }),
        });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, persistence } = created;
        const [, tickError] = await runtime.tick(1000);
        expect(tickError).toBeNull();
        const readiness = persistence.episodes.find(
            (episode) => episode.kind === 'night.readiness',
        );
        expect(readiness === undefined).toBe(false);
    });

    it('skips deliberation while a job is active or autonomy is paused', async () => {
        const working = createRuntime({ isJobActive: () => true });
        expect(working).not.toBeNull();
        if (working === null) return;
        expect((await working.runtime.tick(1000))[0]?.action).toBe('job');
        const paused = createRuntime({ isPaused: () => true });
        expect(paused).not.toBeNull();
        if (paused === null) return;
        expect((await paused.runtime.tick(1000))[0]?.action).toBe('paused');
        expect(paused.skills.runs).toHaveLength(0);
    });

    it('retries then abandons a failing goal', async () => {
        const skills = new FakeSkills();
        skills.result = skillStep('failed', 'target-missing');
        skills.resumeResult = [null, 'no checkpoint for eat'];
        const created = createRuntime({ skills });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, persistence } = created;
        expect((await runtime.tick(1000))[0]?.action).toBe('retry');
        expect((await runtime.tick(1000))[0]?.action).toBe('retry');
        expect((await runtime.tick(1000))[0]?.action).toBe('abandoned');
        expect(runtime.hasActiveGoal).toBe(false);
        expect(persistence.episodes.some((episode) => episode.kind === 'goal.abandoned')).toBe(
            true,
        );
    });

    it('resumes a valid checkpoint when retrying a failed goal', async () => {
        const skills = new FakeSkills();
        skills.result = skillStep('failed', 'target-missing');
        const created = createRuntime({ skills });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime } = created;
        const [first] = await runtime.tick(1000);
        expect(first?.action).toBe('retry');
        expect(skills.resumes.at(-1)?.taskId).toBe(first?.goalId);
        expect(skills.activeSkillId).toBe('eat');
        expect((await runtime.tick(1000))[0]?.action).toBe('running');
    });

    it('abandons an expired goal with the deadline reason', async () => {
        const intention: Intention = {
            goalId: 'goal:eat:eat-food-to-restore-hunger',
            label: 'Eat food to restore hunger',
            stepIndex: 0,
            createdAt: '1970-01-01T00:00:00.000Z',
            deadline: '1970-01-01T00:00:00.000Z',
            deadlineExtended: true,
            attempts: 0,
        };
        const created = createRuntime({ intention });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, persistence } = created;
        const [, restoreError] = runtime.restore();
        expect(restoreError).toBeNull();
        expect((await runtime.tick(1000))[0]?.action).toBe('abandoned');
        const abandoned = persistence.episodes.find((episode) => episode.kind === 'goal.abandoned');
        expect((abandoned?.payload as { reason?: string } | undefined)?.reason).toBe('deadline');
    });

    it('extends an expired goal once when work advanced', async () => {
        const intention: Intention = {
            goalId: 'goal:eat:eat-food-to-restore-hunger',
            label: 'Eat food to restore hunger',
            stepIndex: 0,
            createdAt: '1970-01-01T00:00:00.000Z',
            deadline: '1970-01-01T00:00:00.000Z',
            attempts: 0,
        };
        const created = createRuntime({ intention });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime } = created;
        runtime.restore();
        runtime.observeProgress({
            botId: 'bot.one',
            taskId: intention.goalId,
            at: '1970-01-01T00:00:00.500Z',
            skillId: 'eat',
            status: 'running',
            progress: { done: 1, total: 2, label: 'eating' },
        });
        expect((await runtime.tick(1000))[0]?.action).toBe('running');
    });

    it('preempts and retries a stalled skill', async () => {
        const created = createRuntime({ progressTimeoutMilliseconds: 10 });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills } = created;
        expect((await runtime.tick(1000))[0]?.action).toBe('running');
        expect((await runtime.tick(2000))[0]?.action).toBe('retry');
        expect(skills.preempts.includes('progress timeout')).toBe(true);
    });

    it('restores a persisted intention when its goal still exists', async () => {
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
        expect((await runtime.tick(1000))[0]?.action).toBe('running');
        expect(skills.runs[0]?.skillId).toBe('eat');
    });
});

const project: ProjectSummary = {
    id: 'project-1',
    title: 'Home of TiBot1',
    kind: 'home',
    status: 'active',
    anchor: { x: 0, y: 64, z: 0 },
    bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 6, y: 67, z: 6 } },
    structureId: 'structure.project-1',
    storageId: null,
};

describe('agency runtime project focus', () => {
    it('keeps project focus instead of selecting optional goals', async () => {
        const created = createRuntime({
            project,
            snapshot: snapshot({ food: 20, inventory: [] }),
        });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills } = created;
        expect(runtime.focus?.kind).toBe('project');
        const [report, tickError] = await runtime.tick(1000);
        expect(tickError).toBeNull();
        expect(report?.action).toBe('project');
        expect(skills.runs).toHaveLength(0);
    });

    it('reports project sub-work without replacing project focus', async () => {
        const created = createRuntime({
            project,
            isProjectTaskActive: () => true,
            snapshot: snapshot({ food: 20, inventory: [] }),
        });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime } = created;
        expect((await runtime.tick(1000))[0]?.action).toBe('project');
        expect(runtime.focus?.kind).toBe('project');
    });

    it('lets survival interrupt and restores project focus on completion', async () => {
        const created = createRuntime({
            project,
            snapshot: snapshot({ food: 20, inventory: [], hostiles: ['zombie'] }),
        });
        expect(created).not.toBeNull();
        if (created === null) return;
        const { runtime, skills, persistence } = created;
        const [report, tickError] = await runtime.tick(1000);
        expect(tickError).toBeNull();
        expect(report?.action).toBe('running');
        expect(skills.runs[0]?.skillId).toBe('flee-defend');
        expect(runtime.focus?.kind).toBe('agency');
        expect(runtime.workingMemory.interruption?.interruptedFocusId).toBe('project-1');
        const goalId = persistence.episodes[0]?.goalId;
        if (goalId === null || goalId === undefined) return;
        skills.activeSkillId = null;
        runtime.observeProgress({
            botId: 'bot.one',
            taskId: goalId,
            at: '2026-11-11T12:00:01.000Z',
            skillId: 'flee-defend',
            status: 'completed',
            progress: { done: 1, total: 1, label: 'safe' },
        });
        expect(runtime.focus?.kind).toBe('project');
        expect(runtime.workingMemory.interruption).toBeNull();
    });
});

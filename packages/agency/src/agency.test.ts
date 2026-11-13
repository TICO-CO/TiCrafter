import { describe, expect, it } from 'bun:test';

import { AgencyState } from './agency-state.js';
import { GoalArbiter } from './goal-arbiter.js';
import { GoalGenerator } from './goal-generator.js';
import { IntentionManager } from './intention-manager.js';
import { NeedsModel } from './needs-model.js';
import { PersonalityModel } from './personality-model.js';
import { RoutineModel } from './routine-model.js';
import { SocialEngine } from './social-engine.js';
import type { AgencySnapshot, Goal, SocialContext } from './types.js';
import { WorkingMemoryModel } from './working-memory.js';

function snapshot(overrides: Partial<AgencySnapshot> = {}): AgencySnapshot {
    return {
        at: '2026-11-11T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 6000,
        inventory: [],
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: { x: 0, y: 64, z: 0 },
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

function context(overrides: Partial<SocialContext> = {}): SocialContext {
    return {
        botName: 'TiBot1',
        recipient: 'TiBot2',
        phase: 'day',
        activeGoal: 'Gather nearby wood',
        ...overrides,
    };
}

describe('agency', () => {
    it('creates bounded personality traits and needs', () => {
        const personality = PersonalityModel.fromBotIndex(3);
        expect(personality.weight('curiosity') >= 0).toBe(true);
        expect(personality.weight('curiosity') <= 1).toBe(true);
        const [needs, needsError] = NeedsModel.create({ hunger: 0.4 });
        expect(needsError).toBeNull();
        expect(needs?.levels.hunger).toBe(0.4);
        const [rejected, rejectedError] = NeedsModel.create({ hunger: 2 });
        expect(rejected).toBeNull();
        expect(rejectedError).not.toBeNull();
    });

    it('decays and satisfies needs', () => {
        const [needs, needsError] = NeedsModel.create({ hunger: 0.5 });
        expect(needsError).toBeNull();
        if (needs === null) return;
        const decayed = needs.decay(60_000);
        expect(decayed.levels.hunger < 0.5).toBe(true);
        expect(decayed.satisfy('hunger', 0.3).levels.hunger > decayed.levels.hunger).toBe(true);
    });

    it('restores validated needs and personality traits', () => {
        const [needs, needsError] = NeedsModel.restore({ ...NeedsModel.defaults().levels });
        expect(needsError).toBeNull();
        expect(needs?.levels.safety).toBe(1);
        const [missingNeeds, missingNeedsError] = NeedsModel.restore({ hunger: 0.5 });
        expect(missingNeeds).toBeNull();
        expect(missingNeedsError).not.toBeNull();
        const [traits, traitsError] = PersonalityModel.restore({
            ...PersonalityModel.fromBotIndex(2).traits,
        });
        expect(traitsError).toBeNull();
        expect((traits?.weight('curiosity') ?? -1) >= 0).toBe(true);
        const [invalidTraits, invalidTraitsError] = PersonalityModel.restore({ caution: 3 });
        expect(invalidTraits).toBeNull();
        expect(invalidTraitsError).not.toBeNull();
    });

    it('decays needs at per-need rates', () => {
        const decayed = NeedsModel.defaults().decay(60_000, {
            hunger: 0.5,
            materials: 0,
        });
        expect(decayed.levels.hunger).toBe(0.5);
        expect(decayed.levels.materials).toBe(0.5);
        const [state, stateError] = AgencyState.create({ botId: 'bot.tibot1' });
        expect(stateError).toBeNull();
        if (state === null) return;
        const next = state.decayNeedsByNeed(60_000, { hunger: 0.2 });
        expect(next.snapshot.needs.levels.hunger).toBe(0.8);
    });

    it('decays all needs at a uniform configured rate', () => {
        const decayed = NeedsModel.defaults().decayUniform(60_000, 0.1);
        expect(decayed.levels.safety < 1).toBe(true);
        expect(decayed.levels.hunger < 1).toBe(true);
    });

    it('binds mine and explore goals to concrete targets', () => {
        const [needs, needsError] = NeedsModel.create({ materials: 0.1 });
        expect(needsError).toBeNull();
        if (needs === null) return;
        const [goals, goalError] = new GoalGenerator().generate(
            snapshot({ knownResourceSites: [{ kind: 'wood', position: { x: 4, y: 64, z: 2 } }] }),
            needs,
            PersonalityModel.fromBotIndex(4),
            'day',
        );
        expect(goalError).toBeNull();
        if (goals === null) return;
        const gather = goals.find((goal) => goal.label === 'Gather nearby wood');
        expect(gather?.steps[0]?.input.target).toEqual({ x: 4, y: 64, z: 2 });
        const explore = goals.find((goal) => goal.kind === 'explore');
        expect(explore?.steps[0]?.input.center).toEqual({ x: 0, y: 64, z: 0 });
    });

    it('materializes farm goals only for permitted plots', () => {
        const [needs, needsError] = NeedsModel.create({ materials: 0.1, hunger: 0.8 });
        expect(needsError).toBeNull();
        if (needs === null) return;
        const [permitted] = new GoalGenerator().generate(
            snapshot({
                farmPlots: [
                    {
                        id: 'farm.1',
                        bbox: {
                            min: { x: 0, y: 63, z: 0 },
                            max: { x: 2, y: 64, z: 2 },
                        },
                        permitted: true,
                    },
                ],
            }),
            needs,
            PersonalityModel.fromBotIndex(4),
            'day',
        );
        const harvest = permitted?.find((goal) => goal.kind === 'harvest-farm');
        expect(harvest?.steps[0]?.input.plotId).toBe('farm.1');
        expect(harvest?.target).toEqual({ x: 1, y: 63.5, z: 1 });

        const [unpermitted] = new GoalGenerator().generate(
            snapshot({
                farmPlots: [
                    {
                        id: 'farm.2',
                        bbox: {
                            min: { x: 0, y: 63, z: 0 },
                            max: { x: 2, y: 64, z: 2 },
                        },
                        permitted: false,
                    },
                ],
            }),
            needs,
            PersonalityModel.fromBotIndex(4),
            'day',
        );
        expect(unpermitted?.some((goal) => goal.kind === 'harvest-farm')).toBe(false);
    });

    it('generates and arbitrates a goal from low food', () => {
        const [needs, needsError] = NeedsModel.create({ hunger: 0.2 });
        expect(needsError).toBeNull();
        if (needs === null) return;
        const personality = PersonalityModel.fromBotIndex(0);
        const [goals, goalError] = new GoalGenerator().generate(
            snapshot({ inventory: [{ name: 'bread', count: 3 }] }),
            needs,
            personality,
            'day',
        );
        expect(goalError).toBeNull();
        if (goals === null) return;
        expect(goals.some((goal) => goal.kind === 'eat')).toBe(true);
        const [arbiter, arbiterError] = GoalArbiter.create();
        expect(arbiterError).toBeNull();
        if (arbiter === null) return;
        const [selection, selectionError] = arbiter.select(goals, needs, personality, null);
        expect(selectionError).toBeNull();
        expect(selection?.goal.kind).toBe('eat');
    });

    it('exposes close candidates for a Laya goal tie-break', () => {
        const traits = PersonalityModel.fromBotIndex(0);
        const makeGoal = (id: string): Goal => ({
            id,
            kind: 'explore',
            label: id,
            priority: 50,
            source: 'need',
            target: null,
            steps: [{ skillId: 'explore', label: 'Explore', input: {} }],
            expectedValue: 0.5,
            estimatedCost: 0.1,
            estimatedRisk: 0.1,
            deadline: null,
        });
        const [arbiter, arbiterError] = GoalArbiter.create();
        expect(arbiterError).toBeNull();
        if (arbiter === null) return;
        const [selection, selectionError] = arbiter.select(
            [makeGoal('goal:first'), makeGoal('goal:second')],
            NeedsModel.defaults(),
            traits,
            null,
        );
        expect(selectionError).toBeNull();
        expect(selection?.layaShouldAdvise).toBe(true);
        expect(selection?.closeCandidates).toHaveLength(2);
        const [strictArbiter] = GoalArbiter.create({ closeScore: 0 });
        if (strictArbiter === null) return;
        const [strict] = strictArbiter.select(
            [makeGoal('goal:first'), makeGoal('goal:second')],
            NeedsModel.defaults(),
            traits,
            null,
        );
        expect(strict?.layaShouldAdvise).toBe(false);
    });

    it('rejects an invalid close score', () => {
        expect(GoalArbiter.create({ closeScore: 2 })[1]).not.toBeNull();
    });

    it('tracks intention completion and abandonment', () => {
        const [goal, goalError] = new GoalGenerator().generate(
            snapshot(),
            NeedsModel.defaults(),
            PersonalityModel.fromBotIndex(1),
            'day',
        );
        expect(goalError).toBeNull();
        if (goal === null || goal.length === 0) return;
        const firstGoal = goal[0];
        if (firstGoal === undefined) return;
        const manager = new IntentionManager();
        const [intention, intentionError] = manager.begin(firstGoal, snapshot().at);
        expect(intentionError).toBeNull();
        expect(intention?.goalId).toBe(firstGoal.id);
        const [outcome, outcomeError] = manager.abandon('preempted', snapshot().at);
        expect(outcomeError).toBeNull();
        expect(outcome?.reason).toBe('preempted');
    });

    it('classifies dusk and counts down to night', () => {
        expect(RoutineModel.phase(12_500)).toBe('evening');
        expect(RoutineModel.isDusk('evening')).toBe(true);
        expect(RoutineModel.isNight('night')).toBe(true);
        expect(RoutineModel.ticksUntilNight(11_000)).toBe(2_000);
        expect(RoutineModel.isNightTime(20_000)).toBe(true);
        expect(RoutineModel.isNightTime(12_000)).toBe(false);
    });

    it('does not return to shelter when already home', () => {
        const [goals, goalError] = new GoalGenerator().generate(
            snapshot({ position: { x: 0, y: 64, z: 0 }, home: { x: 0, y: 64, z: 0 } }),
            NeedsModel.defaults(),
            PersonalityModel.fromBotIndex(1),
            'night',
        );
        expect(goalError).toBeNull();
        expect(goals?.some((goal) => goal.kind === 'shelter') ?? true).toBe(false);
    });

    it('builds a dusk preparation goal with actionable steps', () => {
        const [goals, goalError] = new GoalGenerator().generate(
            snapshot({
                timeOfDay: 17_500,
                isSheltered: false,
                digSite: { x: 1, y: 64, z: 0 },
                inventory: [],
            }),
            NeedsModel.defaults(),
            PersonalityModel.fromBotIndex(1),
            'evening',
        );
        expect(goalError).toBeNull();
        if (goals === null) return;
        const prep = goals.find((goal) => goal.kind === 'prepare-night');
        expect(prep === undefined).toBe(false);
        const skillIds = prep?.steps.map((step) => step.skillId) ?? [];
        expect(skillIds.includes('dig-shelter')).toBe(true);
        expect(skillIds.includes('gather-wool')).toBe(true);
        expect(skillIds.includes('gather-food')).toBe(true);
    });

    it('classifies chat and enforces the rate limit', () => {
        const engine = new SocialEngine();
        expect(engine.classify('hello there')).toBe('greeting');
        expect(engine.classify('creeper near the farm')).toBe('danger');
        const reply = engine.reply('greeting', context(), PersonalityModel.fromBotIndex(2));
        expect(reply === null ? false : reply.includes('TiBot2')).toBe(true);
        expect(engine.canSpeak(1000, 1)).toBe(true);
        expect(engine.recordMessage(1000)).toBe(true);
        expect(engine.canSpeak(1000, 1)).toBe(false);
        expect(engine.canSpeak(62_000, 1)).toBe(true);
    });

    it('creates an agency state snapshot', () => {
        const [state, stateError] = AgencyState.create({ botId: 'bot.tibot1', timeOfDay: 1000 });
        expect(stateError).toBeNull();
        expect(state?.snapshot.botId).toBe('bot.tibot1');
        expect(state?.snapshot.routine.phase).toBe('morning');
    });

    it('restores and transitions agency state', () => {
        const [state, stateError] = AgencyState.create({ botId: 'bot.tibot1' });
        expect(stateError).toBeNull();
        if (state === null) return;
        const restored = state
            .decayNeeds(60_000, 0.2)
            .satisfyNeed('hunger', 0.5)
            .touchDeliberation('2026-11-11T12:00:00.000Z')
            .withMood('curious');
        const [copy, copyError] = AgencyState.restore(restored.snapshot);
        expect(copyError).toBeNull();
        expect(copy?.snapshot.mood).toBe('curious');
        expect((copy?.snapshot.needs.levels.hunger ?? 0) > 0.5).toBe(true);
        expect(copy?.snapshot.lastDeliberationAt).toBe('2026-11-11T12:00:00.000Z');
    });

    it('restores working memory and project focus with agency state', () => {
        const [state, stateError] = AgencyState.create({ botId: 'bot.tibot1' });
        expect(stateError).toBeNull();
        if (state === null) return;
        const focused = state.withWorkingMemory(
            WorkingMemoryModel.create().withFocus({
                kind: 'project',
                id: 'project-1',
                label: 'Home of TiBot1',
                startedAt: '2026-11-11T12:00:00.000Z',
            }).snapshot,
        );
        const [copy, copyError] = AgencyState.restore(focused.snapshot);
        expect(copyError).toBeNull();
        expect(copy?.snapshot.workingMemory.focus?.id).toBe('project-1');
        expect(copy?.snapshot.workingMemory.revision).toBe(1);
    });
});

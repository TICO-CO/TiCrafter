import { describe, expect, it } from 'bun:test';

import { AgencyState } from './agency-state.js';
import { GoalArbiter } from './goal-arbiter.js';
import { GoalGenerator } from './goal-generator.js';
import { IntentionManager } from './intention-manager.js';
import { NeedsModel } from './needs-model.js';
import { PersonalityModel } from './personality-model.js';
import { SocialEngine } from './social-engine.js';
import type { AgencySnapshot, SocialContext } from './types.js';

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
        expect(state?.snapshot.routine.phase).toBe('night');
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
});

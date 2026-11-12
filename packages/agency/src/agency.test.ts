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
        const [selection, selectionError] = new GoalArbiter().select(
            goals,
            needs,
            personality,
            null,
        );
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
});

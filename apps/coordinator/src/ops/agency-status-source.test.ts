import { NeedsModel, PersonalityModel, WorkingMemoryModel } from '@ticrafter/agency';
import { describe, expect, it } from 'bun:test';

import { AgencyStatusSource } from './agency-status-source.js';

function source() {
    const [traits, traitsError] = PersonalityModel.create({ sociability: 0.9 });
    expect(traitsError).toBeNull();
    const [needs, needsError] = NeedsModel.create({ hunger: 0.2 });
    expect(needsError).toBeNull();
    if (traits === null || needs === null) return null;
    return new AgencyStatusSource({
        states: {
            load: () => [
                {
                    botId: 'bot.one',
                    traits,
                    needs,
                    intention: {
                        goalId: 'goal:eat:eat-food-to-restore-hunger',
                        label: 'Eat food to restore hunger',
                        stepIndex: 0,
                        createdAt: '2026-11-11T12:00:00.000Z',
                        deadline: null,
                        attempts: 0,
                    },
                    routine: {
                        phase: 'evening',
                        lastMealAt: null,
                        lastRestAt: null,
                    },
                    homeStructureId: 'home.one',
                    personalStorageId: null,
                    mood: 'calm',
                    workingMemory: WorkingMemoryModel.create().snapshot,
                    lastDeliberationAt: '2026-11-11T12:00:00.000Z',
                    updatedAt: '2026-11-11T12:00:00.000Z',
                },
                null,
            ],
        },
        episodes: {
            list: () => [
                [
                    {
                        id: 'episode.one',
                        botId: 'bot.one',
                        goalId: 'goal:eat:eat-food-to-restore-hunger',
                        kind: 'goal.completed',
                        summary: 'Completed Eat food',
                        position: null,
                        relatedBotId: null,
                        payload: {},
                        createdAt: '2026-11-11T12:00:01.000Z',
                    },
                    {
                        id: 'episode.two',
                        botId: 'bot.one',
                        goalId: null,
                        kind: 'chat',
                        summary: 'Said hello',
                        position: null,
                        relatedBotId: null,
                        payload: {},
                        createdAt: '2026-11-11T12:00:02.000Z',
                    },
                ],
                null,
            ],
        },
        sessions: {
            list: () => [
                {
                    botId: 'bot.one',
                    name: 'TiBot1',
                    connectionId: 'connection.one',
                    connectedAt: '2026-11-11T12:00:00.000Z',
                    lastSeen: '2026-11-11T12:00:00.000Z',
                    position: null,
                },
            ],
        },
    });
}

describe('agency status source', () => {
    it('maps persisted agency state and filters goal episodes', () => {
        const view = source();
        expect(view).not.toBeNull();
        if (view === null) return;
        const [snapshot, snapshotError] = view.snapshot('bot.one');
        expect(snapshotError).toBeNull();
        expect(snapshot?.phase).toBe('evening');
        expect(snapshot?.activeGoal).toBe('Eat food to restore hunger');
        expect(snapshot?.recentGoalOutcomes).toEqual(['Completed Eat food']);
        const [episodes, episodeError] = view.episodes('bot.one', 5);
        expect(episodeError).toBeNull();
        expect(episodes).toHaveLength(2);
        expect(view.onlineBotIds()).toEqual([['bot.one'], null]);
    });
});

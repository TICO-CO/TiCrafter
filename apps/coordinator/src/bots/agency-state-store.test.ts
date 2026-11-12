import { NeedsModel, PersonalityModel } from '@ticrafter/agency';
import { afterEach, describe, expect, it } from 'bun:test';

import { CoordinatorTestSupport } from '../testing/index.js';
import { AgencyStateStore } from './agency-state-store.js';

afterEach(() => CoordinatorTestSupport.cleanup());

function record() {
    const [traits, traitsError] = PersonalityModel.create({ curiosity: 0.8, caution: 0.2 });
    expect(traitsError).toBeNull();
    const [needs, needsError] = NeedsModel.create({ hunger: 0.3, materials: 0.7 });
    expect(needsError).toBeNull();
    if (traits === null || needs === null) return null;
    return {
        botId: 'bot.one',
        traits,
        needs,
        intention: {
            goalId: 'goal:eat:eat-food-to-restore-hunger',
            label: 'Eat food to restore hunger',
            stepIndex: 0,
            createdAt: '2026-11-11T12:00:00.000Z',
            deadline: null,
            attempts: 1,
        },
        routine: {
            phase: 'day' as const,
            lastMealAt: null,
            lastRestAt: '2026-11-11T06:00:00.000Z',
        },
        homeStructureId: null,
        personalStorageId: null,
        mood: 'calm',
        lastDeliberationAt: '2026-11-11T12:00:00.000Z',
        updatedAt: '2026-11-11T12:00:00.000Z',
    };
}

describe('agency state store', () => {
    it('round-trips validated agency state', () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new AgencyStateStore(database);
        const saved = record();
        expect(saved).not.toBeNull();
        if (saved === null) return;
        expect(store.save(saved)[1]).toBeNull();
        const [loaded, loadError] = store.load(saved.botId);
        expect(loadError).toBeNull();
        expect(loaded?.traits.weight('curiosity')).toBe(0.8);
        expect(loaded?.needs.levels.hunger).toBe(0.3);
        expect(loaded?.intention?.attempts).toBe(1);
        expect(loaded?.routine.lastRestAt).toBe('2026-11-11T06:00:00.000Z');
    });

    it('stores live snapshots and rejects malformed rows', () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        if (database === null) return;
        const store = new AgencyStateStore(database);
        const saved = record();
        expect(saved).not.toBeNull();
        if (saved === null) return;
        expect(
            store.saveSnapshot(
                saved.botId,
                {
                    traits: saved.traits.traits,
                    needs: saved.needs.levels,
                    intention: saved.intention,
                    routine: saved.routine,
                    homeStructureId: null,
                    personalStorageId: null,
                    mood: 'calm',
                    lastDeliberationAt: null,
                },
                '2026-11-11T12:01:00.000Z',
            )[1],
        ).toBeNull();
        const [loaded, loadError] = store.load(saved.botId);
        expect(loadError).toBeNull();
        expect(loaded?.updatedAt).toBe('2026-11-11T12:01:00.000Z');
        database
            .prepare('INSERT INTO agent_state (bot_id, state_json, updated_at) VALUES (?, ?, ?)')
            .run('bot.bad', '{"needs":{}}', '2026-11-11T12:00:00.000Z');
        const [broken, brokenError] = store.load('bot.bad');
        expect(broken).toBeNull();
        expect(brokenError).not.toBeNull();
    });
});

import { AgencyState, NeedsModel, PersonalityModel } from '@ticrafter/agency';
import type { AgencyStatePayload, LoggerPort, Result, TransportFailure } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { AgencyStateAdapter } from './agency-state-adapter.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

class FakeSink {
    readonly events: { type: string; payload: unknown }[] = [];

    sendEvent(type: string, payload: unknown): Result<void, TransportFailure> {
        this.events.push({ type, payload });
        return [undefined, null];
    }
}

function payload(source: AgencyState): AgencyStatePayload {
    const snapshot = source.snapshot;
    return {
        traits: snapshot.traits.traits,
        needs: snapshot.needs.levels,
        intention: snapshot.intention,
        routine: snapshot.routine,
        homeStructureId: snapshot.homeStructureId,
        personalStorageId: snapshot.personalStorageId,
        mood: snapshot.mood,
        lastDeliberationAt: snapshot.lastDeliberationAt,
    };
}

function state(): AgencyState | null {
    const [needs, needsError] = NeedsModel.create({ hunger: 0.4 });
    expect(needsError).toBeNull();
    if (needs === null) return null;
    const [created, stateError] = AgencyState.create({
        botId: 'bot.one',
        traits: PersonalityModel.fromBotIndex(3),
        needs,
        timeOfDay: 1000,
    });
    expect(stateError).toBeNull();
    if (created === null) return null;
    return created.withIntention({
        goalId: 'goal:eat:eat-food-to-restore-hunger',
        label: 'Eat food to restore hunger',
        stepIndex: 0,
        createdAt: '2026-11-11T12:00:00.000Z',
        deadline: null,
        attempts: 1,
    });
}

describe('agency state adapter', () => {
    it('round-trips state through the coordinator payload', () => {
        const original = state();
        expect(original).not.toBeNull();
        if (original === null) return;
        const [restored, restoreError] = new AgencyStateAdapter({
            botId: 'bot.one',
            events: new FakeSink(),
            logger,
        }).restore(payload(original));
        expect(restoreError).toBeNull();
        expect(restored?.snapshot.intention?.goalId).toBe(original.snapshot.intention?.goalId);
        expect(restored?.snapshot.needs.levels.hunger).toBe(0.4);
    });

    it('rejects missing needs and emits state and episode events', () => {
        const sink = new FakeSink();
        const adapter = new AgencyStateAdapter({ botId: 'bot.one', events: sink, logger });
        const original = state();
        expect(original).not.toBeNull();
        if (original === null) return;
        const [rejected, rejectedError] = adapter.restore({
            ...payload(original),
            needs: {} as AgencyStatePayload['needs'],
        });
        expect(rejected).toBeNull();
        expect(rejectedError).not.toBeNull();
        adapter.save(original.snapshot, '2026-11-11T12:00:00.000Z');
        adapter.episode({
            goalId: 'goal:eat:eat-food-to-restore-hunger',
            kind: 'goal.completed',
            summary: 'Completed Eat food',
        });
        expect(sink.events.map((event) => event.type)).toEqual([
            'bot.agency.state',
            'bot.agency.episode',
        ]);
    });
});

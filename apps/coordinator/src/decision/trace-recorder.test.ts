import type { DecisionRequest } from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { DecisionTraceRecorder } from './trace-recorder.js';
import type { DecisionOutcome } from './types.js';

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const request: DecisionRequest = {
    botId: 'bot.one',
    at: '2026-11-11T10:00:00.000Z',
    digest: {
        health: 20,
        food: 20,
        position: { x: 0, y: 64, z: 0 },
        inventoryCount: 0,
    },
    affordances: [{ id: 'navigate:0', skillId: 'navigate', label: 'Walk north', priority: 1 }],
};

const outcome: DecisionOutcome = {
    response: {
        botId: 'bot.one',
        at: '2026-11-11T10:00:00.000Z',
        choiceId: 'navigate:0',
        probabilities: { 'navigate:0': 0.9 },
        answerConfidence: 0.9,
        danger: false,
        shouldContinue: true,
        latencyMilliseconds: 10,
        source: 'laya',
    },
    fallback: null,
    parsed: {
        choiceId: 'navigate:0',
        probabilities: { 'navigate:0': 0.9 },
        answerConfidence: 0.9,
        danger: false,
        shouldContinue: true,
        dangerScore: 0.1,
        shouldContinueScore: 0.9,
    },
};

describe('DecisionTraceRecorder', () => {
    it('writes raw scores when tracing is enabled', () => {
        const appended: unknown[] = [];
        const events = {
            append: (event: unknown) => {
                appended.push(event);
                return [1, null];
            },
        } as unknown as EventLogWriter;
        const recorder = new DecisionTraceRecorder(events, true, logger);

        recorder.record(request, outcome);

        expect(appended).toHaveLength(1);
        const payload = (appended[0] as { payload: { parsed: { dangerScore: number } } }).payload;
        expect(payload.parsed.dangerScore).toBe(0.1);
    });

    it('does not write when tracing is disabled', () => {
        let writes = 0;
        const events = {
            append: () => {
                writes += 1;
                return [1, null];
            },
        } as unknown as EventLogWriter;
        const recorder = new DecisionTraceRecorder(events, false, logger);

        recorder.record(request, outcome);

        expect(writes).toBe(0);
    });
});

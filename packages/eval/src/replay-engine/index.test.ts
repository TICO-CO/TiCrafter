import type { BlockChangelogReader, EventLogWriter } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { ReplayEngine } from './index.js';

const events = {
    listAfter: () => [
        [
            {
                id: 1,
                botId: 'bot.one',
                type: 'task.transition',
                payload: {},
                createdAt: '2026-11-11T10:00:00.000Z',
            },
        ],
        null,
    ],
};

const blocks = {
    listAfter: () => [
        [
            {
                id: 1,
                botId: 'bot.one',
                position: { x: 1, y: 64, z: 1 },
                after: { blockId: 'stone' },
                createdAt: '2026-11-11T10:00:01.000Z',
            },
            {
                id: 2,
                botId: 'bot.one',
                position: { x: 1, y: 64, z: 1 },
                after: { blockId: 'dirt' },
                createdAt: '2026-11-11T10:00:02.000Z',
            },
        ],
        null,
    ],
};

describe('ReplayEngine', () => {
    it('merges events and block changes into a timeline', () => {
        const engine = new ReplayEngine(
            events as unknown as EventLogWriter,
            blocks as unknown as BlockChangelogReader,
        );

        const [report, replayError] = engine.replay();

        expect(replayError).toBeNull();
        expect(report?.events).toBe(1);
        expect(report?.blockChanges).toBe(2);
        expect(report?.duplicates).toBe(1);
        expect(report?.timeline).toHaveLength(3);
        expect(report?.timeline[0]?.kind).toBe('event');
    });
});

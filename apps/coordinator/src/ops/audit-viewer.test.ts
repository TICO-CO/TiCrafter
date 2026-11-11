import type { DomainEvent, Episode, StoredBlockChange } from '@ticrafter/memory';
import { describe, expect, it } from 'bun:test';

import { OpsAuditViewer } from './audit-viewer.js';

const event: DomainEvent = { type: 'task.created', createdAt: '2026-11-11T10:00:00.000Z' };
const block: StoredBlockChange = {
    id: 1,
    botId: 'bot.one',
    position: { x: 0, y: 64, z: 0 },
    createdAt: '2026-11-11T10:00:00.000Z',
};
const episode: Episode = { id: 'episode-1', outcome: 'completed' };

describe('OpsAuditViewer', () => {
    it('reads events, blocks, and episodes', () => {
        const viewer = new OpsAuditViewer({
            events: { list: () => [[event], null] },
            blocks: {
                listAfter: () => [[block], null],
                listByBot: () => [[block], null],
            },
            episodes: { list: () => [[episode], null] },
        });

        expect(viewer.events()[0]).toHaveLength(1);
        expect(viewer.blocks(10, 'bot.one')[0]).toHaveLength(1);
        expect(viewer.episodes()[0]?.[0]?.id).toBe('episode-1');
    });

    it('maps read failures', () => {
        const viewer = new OpsAuditViewer({
            events: { list: () => [null, { type: 'READ_FAILED', message: 'broken' }] },
            blocks: {
                listAfter: () => [[], null],
                listByBot: () => [[], null],
            },
            episodes: { list: () => [[], null] },
        });

        const [events, eventsError] = viewer.events();

        expect(events).toBeNull();
        expect(eventsError?.type).toBe('STORAGE');
    });
});

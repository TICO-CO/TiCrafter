import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { PlayerConfidenceStore } from './player-confidence-store.js';

const now = '2026-11-13T00:00:00.000Z';

function store(): PlayerConfidenceStore {
    const [database, openError] = CoordinatorTestSupport.openDatabase();
    expect(openError).toBeNull();
    return new PlayerConfidenceStore(database as CoordinatorDatabase, {
        initialScore: 0.5,
        halfLifeDays: 30,
        linkMinSightings: 3,
        linkWindowMs: 600_000,
    });
}

describe('PlayerConfidenceStore', () => {
    afterEach(() => CoordinatorTestSupport.cleanup());

    it('seeds operator base links', () => {
        const confidence = store();
        const [, seedError] = confidence.seedLinks(
            [{ playerId: 'player.alex', username: 'Alex', baseId: 'base.1' }],
            now,
        );
        expect(seedError).toBeNull();
        const [linked, listError] = confidence.linkedPlayers('base.1', now);
        expect(listError).toBeNull();
        expect(linked?.map((player) => player.playerId)).toEqual(['player.alex']);
    });

    it('links a player after repeated proximity sightings', () => {
        const confidence = store();
        confidence.recordSighting('player.alex', 'Alex', 'base.1', '2026-11-13T00:00:00.000Z');
        confidence.recordSighting('player.alex', 'Alex', 'base.1', '2026-11-13T00:01:00.000Z');
        const [linked, linkError] = confidence.recordSighting(
            'player.alex',
            'Alex',
            'base.1',
            '2026-11-13T00:02:00.000Z',
        );
        expect(linkError).toBeNull();
        expect(linked?.linkedBaseIds.includes('base.1')).toBe(true);
    });

    it('raises and lowers confidence from permission outcomes', () => {
        const confidence = store();
        confidence.seedLinks(
            [{ playerId: 'player.alex', username: 'Alex', baseId: 'base.1' }],
            now,
        );
        const [raised, raiseError] = confidence.recordPermissionOutcome('player.alex', true, now);
        expect(raiseError).toBeNull();
        expect(Math.abs((raised?.score ?? 0) - 0.55) < 0.000001).toBe(true);
        const [lowered, lowerError] = confidence.recordPermissionOutcome('player.alex', false, now);
        expect(lowerError).toBeNull();
        expect(Math.abs((lowered?.score ?? 0) - 0.45) < 0.000001).toBe(true);
    });

    it('decays confidence over time', () => {
        const confidence = store();
        confidence.seedLinks(
            [{ playerId: 'player.alex', username: 'Alex', baseId: 'base.1' }],
            now,
        );
        const [linked] = confidence.linkedPlayers('base.1', '2026-12-13T00:00:00.000Z');
        expect(Math.abs((linked?.[0]?.score ?? 0) - 0.25) < 0.000001).toBe(true);
    });
});

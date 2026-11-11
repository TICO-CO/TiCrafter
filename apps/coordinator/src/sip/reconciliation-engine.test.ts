import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';
import type {
    BoundingBox,
    DeviationFinding,
    IntendedStructure,
    Landmark,
} from '@ticrafter/worldmodel';
import { describe, expect, it } from 'bun:test';

import { SipReconciliationEngine } from './reconciliation-engine.js';
import { SipFixtures } from './sip-fixtures.js';
import type { SipProposalInput, SipSnapshot } from './types.js';

const landmark = (): Landmark => ({
    id: 'landmark.house',
    type: 'house',
    bbox: {
        min: { x: -2, y: 64, z: -2 },
        max: { x: 2, y: 66, z: 2 },
    },
    anchors: [],
    confidence: 0.9,
    confidenceUpdatedAt: '2026-11-11T00:00:00.000Z',
    lastSeen: '2026-11-11T00:00:00.000Z',
    evidence: [],
    planId: null,
});

const snapshot = (): SipSnapshot => ({
    ...SipFixtures.snapshot(),
    structures: [SipFixtures.structure()],
});

class FakeWorld {
    constructor(private readonly landmarks: readonly Landmark[]) {}

    reconcile(
        _intended: readonly IntendedStructure[],
    ): Result<readonly DeviationFinding[], string> {
        return [[], null];
    }

    intersecting(_bbox: BoundingBox): Result<readonly Landmark[], string> {
        return [this.landmarks, null];
    }
}

class FakeCommitter {
    readonly proposals: SipProposalInput[] = [];

    commit(input: SipProposalInput): Result<number, string> {
        this.proposals.push(input);
        return [1, null];
    }
}

class FakeEvents {
    readonly events: Array<{ type: string; actor?: string; payload?: unknown }> = [];

    append(event: {
        type: string;
        actor?: string;
        payload?: unknown;
    }): Result<number, StorageFailure> {
        this.events.push(event);
        return [1, null];
    }
}

describe('SIP reconciliation engine', () => {
    it('commits observed progress and audits the change', () => {
        const committer = new FakeCommitter();
        const events = new FakeEvents();
        const engine = new SipReconciliationEngine(
            { loadSnapshot: () => [snapshot(), null] },
            new FakeWorld([landmark()]),
            committer,
            events,
        );
        const [report, error] = engine.run();
        expect(error).toBeNull();
        expect(report?.revision).toBe(1);
        expect(report?.progressChanges[0]?.next).toBe(1);
        expect(committer.proposals[0]?.mutations[0]?.kind).toBe('structure.upsert');
        expect(events.events[0]?.type).toBe('sip.reconciliation');
    });

    it('keeps progress when no observation confirms it', () => {
        const committer = new FakeCommitter();
        const events = new FakeEvents();
        const engine = new SipReconciliationEngine(
            { loadSnapshot: () => [snapshot(), null] },
            new FakeWorld([]),
            committer,
            events,
        );
        const [report, error] = engine.run();
        expect(error).toBeNull();
        expect(report?.progressChanges).toHaveLength(0);
        expect(committer.proposals).toHaveLength(0);
        expect(events.events).toHaveLength(0);
    });

    it('audits deviations without changing progress', () => {
        const committer = new FakeCommitter();
        const events = new FakeEvents();
        const world = new FakeWorld([]);
        world.reconcile = () => [
            [
                {
                    structureId: 'structure.house',
                    kind: 'missing',
                    bbox: {
                        min: { x: -2, y: 64, z: -2 },
                        max: { x: 2, y: 66, z: 2 },
                    },
                    observedLandmarkIds: [],
                },
            ],
            null,
        ];
        const engine = new SipReconciliationEngine(
            { loadSnapshot: () => [snapshot(), null] },
            world,
            committer,
            events,
        );
        const [report, error] = engine.run();
        expect(error).toBeNull();
        expect(report?.findings).toHaveLength(1);
        expect(committer.proposals).toHaveLength(0);
        expect(events.events).toHaveLength(1);
    });
});

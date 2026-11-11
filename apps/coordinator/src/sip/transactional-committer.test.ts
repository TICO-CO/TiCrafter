import { afterEach, describe, expect, it } from 'bun:test';

import type { CoordinatorDatabase } from '../core/index.js';
import { SipFixtures } from './sip-fixtures.js';
import { SipTestSupport } from './sip-test-support.js';
import { SipTransactionalCommitter } from './transactional-committer.js';
import type { SipProposalInput } from './types.js';

interface RevisionRow {
    revision: number;
}

interface CountRow {
    count: number;
}

function openCommitter(): {
    database: CoordinatorDatabase;
    committer: SipTransactionalCommitter;
} | null {
    const [database, openError] = SipTestSupport.openDatabase();
    expect(openError).toBeNull();
    if (database === null) return null;
    return { database, committer: new SipTransactionalCommitter(database) };
}

function revisionOf(database: CoordinatorDatabase): number | undefined {
    return (
        database.prepare('SELECT revision FROM sip WHERE id = 1').get() as RevisionRow | undefined
    )?.revision;
}

function revisionCount(database: CoordinatorDatabase): number {
    return (database.prepare('SELECT COUNT(*) AS count FROM sip_revisions').get() as CountRow)
        .count;
}

afterEach(() => {
    SipTestSupport.cleanup();
});

describe('SIP transactional committer', () => {
    it('commits a mutation and increments the revision once', () => {
        const opened = openCommitter();
        if (opened === null) return;
        const [commit, error] = opened.committer.commit(
            SipFixtures.proposal([{ kind: 'zone.upsert', zone: SipFixtures.zone() }]),
        );
        expect(error).toBeNull();
        expect(commit?.revision).toBe(1);
        expect(commit?.snapshot.zones).toHaveLength(1);
        expect(revisionOf(opened.database)).toBe(1);
        expect(revisionCount(opened.database)).toBe(1);
        opened.database.close();
    });

    it('applies a mutation batch under one revision', () => {
        const opened = openCommitter();
        if (opened === null) return;
        const [commit, error] = opened.committer.commit(
            SipFixtures.proposal([
                { kind: 'zone.upsert', zone: SipFixtures.zone() },
                { kind: 'structure.upsert', structure: SipFixtures.structure() },
            ]),
        );
        expect(error).toBeNull();
        expect(commit?.revision).toBe(1);
        expect(commit?.snapshot.zones).toHaveLength(1);
        expect(commit?.snapshot.structures).toHaveLength(1);
        expect(revisionCount(opened.database)).toBe(1);
        opened.database.close();
    });

    it('rejects stale revisions without writing', () => {
        const opened = openCommitter();
        if (opened === null) return;
        opened.committer.commit(
            SipFixtures.proposal([{ kind: 'zone.upsert', zone: SipFixtures.zone() }]),
        );
        const [, error] = opened.committer.commit(
            SipFixtures.proposal(
                [{ kind: 'zone.upsert', zone: SipFixtures.zone({ id: 'zone.stale' }) }],
                0,
                'proposal-stale',
            ),
        );
        expect(error?.type).toBe('STALE_REVISION');
        expect(revisionOf(opened.database)).toBe(1);
        expect(revisionCount(opened.database)).toBe(1);
        opened.database.close();
    });

    it('rolls back when spatial validation fails', () => {
        const opened = openCommitter();
        if (opened === null) return;
        opened.committer.commit(
            SipFixtures.proposal(
                [
                    {
                        kind: 'rules.replace',
                        rules: {
                            protectedBboxes: [
                                {
                                    min: { x: -3, y: 63, z: -3 },
                                    max: { x: 3, y: 67, z: 3 },
                                },
                            ],
                            allowedEdits: [],
                            noBreakUnderActiveBot: true,
                        },
                    },
                ],
                0,
                'proposal-rules',
            ),
        );
        const [, error] = opened.committer.commit(
            SipFixtures.proposal(
                [{ kind: 'structure.upsert', structure: SipFixtures.structure() }],
                1,
                'proposal-protected',
            ),
        );
        expect(error?.type).toBe('VALIDATION');
        expect(revisionOf(opened.database)).toBe(1);
        expect(revisionCount(opened.database)).toBe(1);
        opened.database.close();
    });

    it('rolls back when dependency validation fails', () => {
        const opened = openCommitter();
        if (opened === null) return;
        const [, error] = opened.committer.commit(
            SipFixtures.proposal([
                {
                    kind: 'path-graph.replace',
                    pathGraph: SipFixtures.pathGraph({
                        edges: [
                            {
                                id: 'path-edge.bad',
                                from: 'path-node.a',
                                to: 'path-node.missing',
                                cost: 1,
                            },
                        ],
                    }),
                },
            ]),
        );
        expect(error?.type).toBe('VALIDATION');
        expect(revisionOf(opened.database) ?? null).toBeNull();
        expect(revisionCount(opened.database)).toBe(0);
        opened.database.close();
    });

    it('replays idempotent proposals without a new revision', () => {
        const opened = openCommitter();
        if (opened === null) return;
        const proposal = SipFixtures.proposal(
            [{ kind: 'zone.upsert', zone: SipFixtures.zone() }],
            0,
            'proposal-idempotent',
        );
        const [first, firstError] = opened.committer.commit(proposal);
        expect(firstError).toBeNull();
        const [second, secondError] = opened.committer.commit(proposal);
        expect(secondError).toBeNull();
        expect(second?.revision).toBe(first?.revision ?? -1);
        expect(revisionCount(opened.database)).toBe(1);
        opened.database.close();
    });

    it('rejects malformed proposals', () => {
        const opened = openCommitter();
        if (opened === null) return;
        const malformed = {
            metadata: { actor: '', expectedRevision: -1, idempotencyKey: '' },
            mutations: [],
        } as unknown as SipProposalInput;
        const [, error] = opened.committer.commit(malformed);
        expect(error?.type).toBe('VALIDATION');
        expect(revisionCount(opened.database)).toBe(0);
        opened.database.close();
    });
});

import { describe, expect, it } from 'bun:test';

import { SipDependencyValidator } from './dependency-validator.js';
import { SipFixtures } from './sip-fixtures.js';
import { SpatialOverlapValidator } from './spatial-overlap-validator.js';
import type { SipSnapshot } from './types.js';

describe('SIP spatial overlap validator', () => {
    it('rejects mutations inside protected regions', () => {
        const structure = SipFixtures.structure();
        const snapshot: SipSnapshot = {
            ...SipFixtures.snapshot(),
            rules: {
                protectedBboxes: [
                    {
                        min: { x: -1, y: 64, z: -1 },
                        max: { x: 1, y: 66, z: 1 },
                    },
                ],
                allowedEdits: [],
                noBreakUnderActiveBot: true,
            },
        };
        const proposal = SipFixtures.proposal([{ kind: 'structure.upsert', structure }]);
        const [, error] = new SpatialOverlapValidator().validate(snapshot, proposal);
        expect(error?.type).toBe('PROTECTED_REGION');
    });

    it('rejects mutations inside no-build zones', () => {
        const structure = SipFixtures.structure();
        const snapshot: SipSnapshot = {
            ...SipFixtures.snapshot(),
            zones: [SipFixtures.zone({ id: 'zone.no-build', type: 'no_build' })],
        };
        const proposal = SipFixtures.proposal([{ kind: 'structure.upsert', structure }]);
        const [, error] = new SpatialOverlapValidator().validate(snapshot, proposal);
        expect(error?.type).toBe('NO_BUILD_ZONE');
    });

    it('rejects collisions with active structures', () => {
        const active = SipFixtures.structure({ id: 'structure.active', status: 'building' });
        const proposed = SipFixtures.structure({ id: 'structure.proposed' });
        const snapshot: SipSnapshot = { ...SipFixtures.snapshot(), structures: [active] };
        const proposal = SipFixtures.proposal([{ kind: 'structure.upsert', structure: proposed }]);
        const [, error] = new SpatialOverlapValidator().validate(snapshot, proposal);
        expect(error?.type).toBe('ACTIVE_STRUCTURE');
    });

    it('allows active-structure collisions covered by an allowed edit', () => {
        const active = SipFixtures.structure({ id: 'structure.active', status: 'building' });
        const proposed = SipFixtures.structure({ id: 'structure.proposed' });
        const snapshot: SipSnapshot = {
            ...SipFixtures.snapshot(),
            structures: [active],
            rules: {
                protectedBboxes: [],
                allowedEdits: [
                    {
                        bbox: {
                            min: { x: -3, y: 63, z: -3 },
                            max: { x: 3, y: 67, z: 3 },
                        },
                        botIds: ['bot.tibot1'],
                        operations: ['place'],
                    },
                ],
                noBreakUnderActiveBot: true,
            },
        };
        const proposal = SipFixtures.proposal([{ kind: 'structure.upsert', structure: proposed }]);
        const [, error] = new SpatialOverlapValidator().validate(snapshot, proposal);
        expect(error).toBeNull();
    });
});

describe('SIP dependency validator', () => {
    it('accepts an empty snapshot', () => {
        const [, error] = new SipDependencyValidator().validate(SipFixtures.snapshot());
        expect(error).toBeNull();
    });

    it('rejects dangling path edges', () => {
        const snapshot: SipSnapshot = {
            ...SipFixtures.snapshot(),
            pathGraph: SipFixtures.pathGraph({
                edges: [
                    { id: 'path-edge.bad', from: 'path-node.a', to: 'path-node.missing', cost: 1 },
                ],
            }),
        };
        const [, error] = new SipDependencyValidator().validate(snapshot);
        expect(error?.type).toBe('INVALID_REFERENCE');
    });

    it('rejects duplicate work package ids', () => {
        const first = SipFixtures.structure({ id: 'structure.first' });
        const second = SipFixtures.structure({ id: 'structure.second' });
        const snapshot: SipSnapshot = {
            ...SipFixtures.snapshot(),
            structures: [first, second],
        };
        const [, error] = new SipDependencyValidator().validate(snapshot);
        expect(error?.type).toBe('DUPLICATE_ID');
    });

    it('rejects road segments outside the polyline', () => {
        const road = SipFixtures.road({
            segments: [
                {
                    id: 'road-segment.bad',
                    from: { x: 0, y: 64, z: 0 },
                    to: { x: 99, y: 64, z: 99 },
                    status: 'planned',
                    ownerBotId: null,
                },
            ],
        });
        const snapshot: SipSnapshot = { ...SipFixtures.snapshot(), roads: [road] };
        const [, error] = new SipDependencyValidator().validate(snapshot);
        expect(error?.type).toBe('INVALID_REFERENCE');
    });
});

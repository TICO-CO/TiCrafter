import { SipSnapshotCodec } from './snapshot-codec.js';
import type {
    SipContainer,
    SipFarm,
    SipPathGraph,
    SipProposal,
    SipRoad,
    SipSnapshot,
    SipStructure,
    SipZone,
} from './types.js';

export class SipFixtures {
    static snapshot(): SipSnapshot {
        return SipSnapshotCodec.defaults();
    }

    static zone(overrides: Partial<SipZone> = {}): SipZone {
        return {
            id: 'zone.base',
            name: 'Base',
            type: 'base',
            polygon: [
                { x: 0, y: 64, z: 0 },
                { x: 10, y: 64, z: 0 },
                { x: 0, y: 64, z: 10 },
            ],
            priority: 1,
            ...overrides,
        };
    }

    static structure(overrides: Partial<SipStructure> = {}): SipStructure {
        return {
            id: 'structure.house',
            type: 'house',
            blueprintRef: 'blueprint.house',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
            status: 'planned',
            ownerBotIds: ['bot.tibot1'],
            designRevision: 1,
            collaboration: 'private',
            autoAcceptCompatibleHelpers: false,
            progress: 0,
            materialsNeeded: [],
            workPackages: [
                {
                    id: 'work-package.shell',
                    bbox: {
                        min: { x: -2, y: 64, z: -2 },
                        max: { x: 2, y: 66, z: 2 },
                    },
                    status: 'planned',
                    claimedBy: null,
                },
            ],
            ...overrides,
        };
    }

    static road(overrides: Partial<SipRoad> = {}): SipRoad {
        return {
            id: 'road.main',
            polyline: [
                { x: 0, y: 64, z: 0 },
                { x: 8, y: 64, z: 0 },
            ],
            width: 3,
            material: 'stone',
            segments: [
                {
                    id: 'road-segment.main',
                    from: { x: 0, y: 64, z: 0 },
                    to: { x: 8, y: 64, z: 0 },
                    status: 'planned',
                    ownerBotId: null,
                },
            ],
            status: 'planned',
            ownerBotIds: [],
            ...overrides,
        };
    }

    static farm(overrides: Partial<SipFarm> = {}): SipFarm {
        return {
            id: 'farm.main',
            plots: [
                {
                    id: 'farm-plot.main',
                    bbox: {
                        min: { x: 20, y: 64, z: 20 },
                        max: { x: 28, y: 64, z: 28 },
                    },
                    crop: 'wheat',
                    waterSource: null,
                    growth: 0,
                    assignedBotId: null,
                },
            ],
            status: 'planned',
            ownerBotIds: [],
            ...overrides,
        };
    }

    static container(overrides: Partial<SipContainer> = {}): SipContainer {
        return {
            id: 'container.storage',
            pos: { x: 4, y: 64, z: 4 },
            role: 'storage',
            reservedBy: null,
            contentsSnapshot: null,
            ...overrides,
        };
    }

    static pathGraph(overrides: Partial<SipPathGraph> = {}): SipPathGraph {
        return {
            nodes: [
                { id: 'path-node.a', position: { x: 0, y: 64, z: 0 } },
                { id: 'path-node.b', position: { x: 8, y: 64, z: 0 } },
            ],
            edges: [{ id: 'path-edge.a-b', from: 'path-node.a', to: 'path-node.b', cost: 8 }],
            ...overrides,
        };
    }

    static proposal(
        mutations: SipProposal['mutations'],
        expectedRevision = 0,
        idempotencyKey = 'proposal-1',
    ): SipProposal {
        return {
            metadata: {
                actor: 'bot.tibot1',
                expectedRevision,
                idempotencyKey,
                fencingToken: 1,
                planId: 'plan-1',
                grantId: null,
            },
            mutations,
        };
    }
}

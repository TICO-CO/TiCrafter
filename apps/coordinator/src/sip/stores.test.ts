import { describe, expect, it } from 'bun:test';

import { ContainerRegistry } from './container-registry.js';
import { FarmStore } from './farm-store.js';
import { PathGraphStore } from './path-graph-store.js';
import { RoadStore } from './road-store.js';
import { RulesStore } from './rules-store.js';
import { SipFixtures } from './sip-fixtures.js';
import { StructureStore } from './structure-store.js';
import { ZoneStore } from './zone-store.js';

describe('SIP stores', () => {
    it('upserts and removes zones', () => {
        const store = new ZoneStore();
        const zone = SipFixtures.zone();
        const added = store.apply(SipFixtures.snapshot(), [{ kind: 'zone.upsert', zone }]);
        expect(store.list(added)).toHaveLength(1);
        expect(store.get(added, zone.id)?.name).toBe('Base');
        const removed = store.apply(added, [{ kind: 'zone.remove', zoneId: zone.id }]);
        expect(store.list(removed)).toHaveLength(0);
    });

    it('upserts and removes structures', () => {
        const store = new StructureStore();
        const structure = SipFixtures.structure();
        const added = store.apply(SipFixtures.snapshot(), [
            { kind: 'structure.upsert', structure },
        ]);
        expect(store.list(added)).toHaveLength(1);
        const removed = store.apply(added, [
            { kind: 'structure.remove', structureId: structure.id },
        ]);
        expect(store.list(removed)).toHaveLength(0);
    });

    it('upserts and removes roads', () => {
        const store = new RoadStore();
        const road = SipFixtures.road();
        const added = store.apply(SipFixtures.snapshot(), [{ kind: 'road.upsert', road }]);
        expect(store.list(added)).toHaveLength(1);
        const removed = store.apply(added, [{ kind: 'road.remove', roadId: road.id }]);
        expect(store.list(removed)).toHaveLength(0);
    });

    it('upserts and removes farms', () => {
        const store = new FarmStore();
        const farm = SipFixtures.farm();
        const added = store.apply(SipFixtures.snapshot(), [{ kind: 'farm.upsert', farm }]);
        expect(store.list(added)).toHaveLength(1);
        const removed = store.apply(added, [{ kind: 'farm.remove', farmId: farm.id }]);
        expect(store.list(removed)).toHaveLength(0);
    });

    it('upserts and removes containers', () => {
        const store = new ContainerRegistry();
        const container = SipFixtures.container();
        const added = store.apply(SipFixtures.snapshot(), [
            { kind: 'container.upsert', container },
        ]);
        expect(store.list(added)).toHaveLength(1);
        const removed = store.apply(added, [
            { kind: 'container.remove', containerId: container.id },
        ]);
        expect(store.list(removed)).toHaveLength(0);
    });

    it('replaces path graph and rules', () => {
        const pathGraphStore = new PathGraphStore();
        const rulesStore = new RulesStore();
        const pathGraph = SipFixtures.pathGraph();
        const rules = {
            protectedBboxes: [],
            allowedEdits: [],
            noBreakUnderActiveBot: false,
        };
        const withGraph = pathGraphStore.apply(SipFixtures.snapshot(), [
            { kind: 'path-graph.replace', pathGraph },
        ]);
        const withRules = rulesStore.apply(withGraph, [{ kind: 'rules.replace', rules }]);
        expect(pathGraphStore.get(withRules).edges).toHaveLength(1);
        expect(rulesStore.get(withRules).noBreakUnderActiveBot).toBe(false);
    });
});

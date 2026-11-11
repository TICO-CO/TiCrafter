import { assertNever } from '@ticrafter/core';

import { SipEntityList } from './collection.js';
import type { SipMutation, SipRoad, SipSnapshot } from './types.js';

export class RoadStore {
    list(snapshot: SipSnapshot): readonly SipRoad[] {
        return snapshot.roads;
    }

    get(snapshot: SipSnapshot, roadId: string): SipRoad | null {
        return snapshot.roads.find((road) => road.id === roadId) ?? null;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const roads = mutations.reduce<readonly SipRoad[]>(
            (current, mutation) => this.applyMutation(current, mutation),
            snapshot.roads,
        );
        if (roads === snapshot.roads) return snapshot;
        return { ...snapshot, roads };
    }

    private applyMutation(roads: readonly SipRoad[], mutation: SipMutation): readonly SipRoad[] {
        switch (mutation.kind) {
            case 'road.upsert':
                return SipEntityList.upsert(roads, mutation.road);
            case 'road.remove':
                return SipEntityList.remove(roads, mutation.roadId);
            case 'zone.upsert':
            case 'zone.remove':
            case 'structure.upsert':
            case 'structure.remove':
            case 'farm.upsert':
            case 'farm.remove':
            case 'container.upsert':
            case 'container.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return roads;
            default:
                return assertNever(mutation);
        }
    }
}

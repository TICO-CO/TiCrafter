import { assertNever } from '@ticrafter/core';

import { SipEntityList } from './collection.js';
import type { SipFarm, SipMutation, SipSnapshot } from './types.js';

export class FarmStore {
    list(snapshot: SipSnapshot): readonly SipFarm[] {
        return snapshot.farms;
    }

    get(snapshot: SipSnapshot, farmId: string): SipFarm | null {
        return snapshot.farms.find((farm) => farm.id === farmId) ?? null;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const farms = mutations.reduce<readonly SipFarm[]>(
            (current, mutation) => this.applyMutation(current, mutation),
            snapshot.farms,
        );
        if (farms === snapshot.farms) return snapshot;
        return { ...snapshot, farms };
    }

    private applyMutation(farms: readonly SipFarm[], mutation: SipMutation): readonly SipFarm[] {
        switch (mutation.kind) {
            case 'farm.upsert':
                return SipEntityList.upsert(farms, mutation.farm);
            case 'farm.remove':
                return SipEntityList.remove(farms, mutation.farmId);
            case 'zone.upsert':
            case 'zone.remove':
            case 'structure.upsert':
            case 'structure.remove':
            case 'road.upsert':
            case 'road.remove':
            case 'container.upsert':
            case 'container.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return farms;
            default:
                return assertNever(mutation);
        }
    }
}

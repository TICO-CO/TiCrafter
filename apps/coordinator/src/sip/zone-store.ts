import { assertNever } from '@ticrafter/core';

import { SipEntityList } from './collection.js';
import type { SipMutation, SipSnapshot, SipZone } from './types.js';

export class ZoneStore {
    list(snapshot: SipSnapshot): readonly SipZone[] {
        return snapshot.zones;
    }

    get(snapshot: SipSnapshot, zoneId: string): SipZone | null {
        return snapshot.zones.find((zone) => zone.id === zoneId) ?? null;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const zones = mutations.reduce<readonly SipZone[]>(
            (current, mutation) => this.applyMutation(current, mutation),
            snapshot.zones,
        );
        if (zones === snapshot.zones) return snapshot;
        return { ...snapshot, zones };
    }

    private applyMutation(zones: readonly SipZone[], mutation: SipMutation): readonly SipZone[] {
        switch (mutation.kind) {
            case 'zone.upsert':
                return SipEntityList.upsert(zones, mutation.zone);
            case 'zone.remove':
                return SipEntityList.remove(zones, mutation.zoneId);
            case 'structure.upsert':
            case 'structure.remove':
            case 'road.upsert':
            case 'road.remove':
            case 'farm.upsert':
            case 'farm.remove':
            case 'container.upsert':
            case 'container.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return zones;
            default:
                return assertNever(mutation);
        }
    }
}

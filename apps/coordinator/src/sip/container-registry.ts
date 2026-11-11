import { assertNever } from '@ticrafter/core';

import { SipEntityList } from './collection.js';
import type { SipContainer, SipMutation, SipSnapshot } from './types.js';

export class ContainerRegistry {
    list(snapshot: SipSnapshot): readonly SipContainer[] {
        return snapshot.containers;
    }

    get(snapshot: SipSnapshot, containerId: string): SipContainer | null {
        return snapshot.containers.find((container) => container.id === containerId) ?? null;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const containers = mutations.reduce<readonly SipContainer[]>(
            (current, mutation) => this.applyMutation(current, mutation),
            snapshot.containers,
        );
        if (containers === snapshot.containers) return snapshot;
        return { ...snapshot, containers };
    }

    private applyMutation(
        containers: readonly SipContainer[],
        mutation: SipMutation,
    ): readonly SipContainer[] {
        switch (mutation.kind) {
            case 'container.upsert':
                return SipEntityList.upsert(containers, mutation.container);
            case 'container.remove':
                return SipEntityList.remove(containers, mutation.containerId);
            case 'zone.upsert':
            case 'zone.remove':
            case 'structure.upsert':
            case 'structure.remove':
            case 'road.upsert':
            case 'road.remove':
            case 'farm.upsert':
            case 'farm.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return containers;
            default:
                return assertNever(mutation);
        }
    }
}

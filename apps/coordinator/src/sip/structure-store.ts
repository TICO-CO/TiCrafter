import { assertNever } from '@ticrafter/core';

import { SipEntityList } from './collection.js';
import type { SipMutation, SipSnapshot, SipStructure } from './types.js';

export class StructureStore {
    list(snapshot: SipSnapshot): readonly SipStructure[] {
        return snapshot.structures;
    }

    get(snapshot: SipSnapshot, structureId: string): SipStructure | null {
        return snapshot.structures.find((structure) => structure.id === structureId) ?? null;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const structures = mutations.reduce<readonly SipStructure[]>(
            (current, mutation) => this.applyMutation(current, mutation),
            snapshot.structures,
        );
        if (structures === snapshot.structures) return snapshot;
        return { ...snapshot, structures };
    }

    private applyMutation(
        structures: readonly SipStructure[],
        mutation: SipMutation,
    ): readonly SipStructure[] {
        switch (mutation.kind) {
            case 'structure.upsert':
                return SipEntityList.upsert(structures, mutation.structure);
            case 'structure.remove':
                return SipEntityList.remove(structures, mutation.structureId);
            case 'zone.upsert':
            case 'zone.remove':
            case 'road.upsert':
            case 'road.remove':
            case 'farm.upsert':
            case 'farm.remove':
            case 'container.upsert':
            case 'container.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return structures;
            default:
                return assertNever(mutation);
        }
    }
}

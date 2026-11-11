import type { SipMutation, SipPathGraph, SipSnapshot } from './types.js';

export class PathGraphStore {
    get(snapshot: SipSnapshot): SipPathGraph {
        return snapshot.pathGraph;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const pathGraph = mutations.reduce<SipPathGraph>(
            (current, mutation) =>
                mutation.kind === 'path-graph.replace' ? mutation.pathGraph : current,
            snapshot.pathGraph,
        );
        if (pathGraph === snapshot.pathGraph) return snapshot;
        return { ...snapshot, pathGraph };
    }
}

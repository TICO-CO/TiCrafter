import type { DecisionState } from './types.js';

export class DecisionDigestCache {
    private readonly entries = new Map<string, DecisionState>();

    constructor(private readonly maximumEntries = 256) {}

    get(key: string): DecisionState | null {
        const state = this.entries.get(key);
        if (state === undefined) return null;
        this.entries.delete(key);
        this.entries.set(key, state);
        return state;
    }

    set(key: string, state: DecisionState): void {
        this.entries.delete(key);
        this.entries.set(key, state);
        if (this.entries.size <= this.maximumEntries) return;
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }

    get size(): number {
        return this.entries.size;
    }
}

import type { SipMutation, SipRules, SipSnapshot } from './types.js';

export class RulesStore {
    get(snapshot: SipSnapshot): SipRules {
        return snapshot.rules;
    }

    apply(snapshot: SipSnapshot, mutations: readonly SipMutation[]): SipSnapshot {
        const rules = mutations.reduce<SipRules>(
            (current, mutation) => (mutation.kind === 'rules.replace' ? mutation.rules : current),
            snapshot.rules,
        );
        if (rules === snapshot.rules) return snapshot;
        return { ...snapshot, rules };
    }
}
